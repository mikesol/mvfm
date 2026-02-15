# Memoized DAG Evaluation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add WeakMap-based memoization with taint tracking to `composeInterpreters` so shared AST nodes are evaluated once.

**Architecture:** Single WeakMap cache + WeakSet taint set inside `composeInterpreters`. Volatile nodes (lambda_param, cursor_batch) propagate taint upward. Non-tainted nodes are cached. Retry uses `.fresh()` for clean re-execution. Cursor stops cloning.

**Tech Stack:** TypeScript, Vitest, postgres.js testcontainers for integration tests.

---

## Context for implementer

**Working directory:** `/home/mikesol/Documents/GitHub/mvfm/mvfm/.worktrees/issue-35`

**Key files you'll touch:**
- `src/core.ts` — `composeInterpreters`, new `RecurseFn` interface, taint helpers
- `src/plugins/fiber/interpreter.ts` — retry handler uses `recurse.fresh()`
- `src/plugins/postgres/3.4.8/interpreter.ts` — cursor stops cloning, uses `findCursorBatch`
- `tests/interpreters/dag-memoization.test.ts` — new test file for basic DAG tests
- `tests/interpreters/dag-memoization-integration.test.ts` — new test file for postgres integration tests

**Design doc:** `docs/plans/2026-02-12-memoized-dag-evaluation-design.md`

**Run commands:**
- Build: `npm run build`
- Lint: `npm run check`
- Test: `npm test`
- Single test file: `npx vitest run tests/interpreters/dag-memoization.test.ts`

---

### Task 1: Core memoization + taint tracking in composeInterpreters

Add WeakMap memoization with taint propagation to `composeInterpreters` in `src/core.ts`. This is the foundation — all other tasks depend on it.

**Files:**
- Modify: `src/core.ts:156-186`
- Create: `tests/interpreters/dag-memoization.test.ts`

**Step 1: Write failing tests for basic DAG memoization**

Create `tests/interpreters/dag-memoization.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { ASTNode, InterpreterFragment } from "../../src/core";
import { composeInterpreters } from "../../src/core";

// A mock "query" fragment that tracks how many times each node is visited
function createTrackingFragment(): {
  fragment: InterpreterFragment;
  visitCount: Map<string, number>;
} {
  const visitCount = new Map<string, number>();
  return {
    visitCount,
    fragment: {
      pluginName: "track",
      canHandle: (node) => node.kind.startsWith("track/"),
      async visit(node: ASTNode, recurse: (n: ASTNode) => Promise<unknown>) {
        const id = (node as any).id as string;
        visitCount.set(id, (visitCount.get(id) ?? 0) + 1);
        switch (node.kind) {
          case "track/value":
            return node.value;
          case "track/add": {
            const left = (await recurse(node.left as ASTNode)) as number;
            const right = (await recurse(node.right as ASTNode)) as number;
            return left + right;
          }
          case "track/pair": {
            const a = await recurse(node.a as ASTNode);
            const b = await recurse(node.b as ASTNode);
            return [a, b];
          }
          case "track/parallel": {
            const elements = node.elements as ASTNode[];
            return Promise.all(elements.map((e) => recurse(e)));
          }
          default:
            throw new Error(`Unknown track node: ${node.kind}`);
        }
      },
    },
  };
}

describe("DAG memoization: shared node deduplication", () => {
  it("shared node evaluated once when used by two consumers in sequence", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([fragment]);

    // shared is used by both "add" nodes
    const shared: ASTNode = { kind: "track/value", value: 10, id: "shared" };
    const a: ASTNode = { kind: "track/add", left: shared, right: { kind: "track/value", value: 1, id: "one" }, id: "a" };
    const b: ASTNode = { kind: "track/add", left: shared, right: { kind: "track/value", value: 2, id: "two" }, id: "b" };
    const root: ASTNode = { kind: "track/pair", a, b, id: "root" };

    const result = await interp(root);
    expect(result).toEqual([11, 12]);
    expect(visitCount.get("shared")).toBe(1); // NOT 2
  });

  it("diamond dependency: D used by B and C, both used by A", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([fragment]);

    const d: ASTNode = { kind: "track/value", value: 5, id: "d" };
    const b: ASTNode = { kind: "track/add", left: d, right: { kind: "track/value", value: 10, id: "ten" }, id: "b" };
    const c: ASTNode = { kind: "track/add", left: d, right: { kind: "track/value", value: 20, id: "twenty" }, id: "c" };
    const a: ASTNode = { kind: "track/pair", a: b, b: c, id: "a" };

    const result = await interp(a);
    expect(result).toEqual([15, 25]);
    expect(visitCount.get("d")).toBe(1);
  });

  it("parallel evaluation with shared node (Promise.all)", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([fragment]);

    const shared: ASTNode = { kind: "track/value", value: 42, id: "shared" };
    const left: ASTNode = { kind: "track/add", left: shared, right: { kind: "track/value", value: 1, id: "one" }, id: "left" };
    const right: ASTNode = { kind: "track/add", left: shared, right: { kind: "track/value", value: 2, id: "two" }, id: "right" };
    const root: ASTNode = { kind: "track/parallel", elements: [left, right], id: "root" };

    const result = await interp(root);
    expect(result).toEqual([43, 44]);
    expect(visitCount.get("shared")).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts`
Expected: Tests PASS but `visitCount.get("shared")` assertions FAIL with `expected 1, received 2` (no memoization yet).

**Step 3: Implement memoization + taint tracking in core.ts**

In `src/core.ts`, replace the `composeInterpreters` function and add helpers. Also add and export the `RecurseFn` interface:

```typescript
// Add after InterpreterFragment interface (around line 166):

/**
 * Extended recurse function with cache control.
 * .fresh() creates a new recurse with empty cache (for retry).
 */
export interface RecurseFn {
  (node: ASTNode): Promise<unknown>;
  fresh(): RecurseFn;
}

// Helper: is this node volatile (value changes across iterations)?
function isVolatile(node: ASTNode): boolean {
  return node.kind === "core/lambda_param" || node.kind === "postgres/cursor_batch";
}

// Helper: does this node have any tainted AST node children?
function hasAnyTaintedChild(node: ASTNode, taintSet: WeakSet<ASTNode>): boolean {
  for (const value of Object.values(node)) {
    if (value !== null && typeof value === "object") {
      if (isASTLike(value) && taintSet.has(value as ASTNode)) return true;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isASTLike(item) && taintSet.has(item as ASTNode)) return true;
        }
      }
    }
  }
  return false;
}

function isASTLike(value: unknown): boolean {
  return typeof value === "object" && value !== null && "kind" in value
    && typeof (value as any).kind === "string";
}

/**
 * Compose interpreter fragments into a memoized DAG evaluator.
 * Shared AST node references are evaluated once (cached by identity).
 * Volatile nodes (lambda_param, cursor_batch) propagate taint upward —
 * tainted nodes and their ancestors skip the cache.
 */
export function composeInterpreters(
  fragments: InterpreterFragment[],
): RecurseFn {
  const cache = new WeakMap<ASTNode, Promise<unknown>>();
  const tainted = new WeakSet<ASTNode>();

  async function recurse(node: ASTNode): Promise<unknown> {
    // Cache check: skip for nodes known to be tainted
    if (!tainted.has(node)) {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
    }

    const fragment = fragments.find((f) => f.canHandle(node));
    if (!fragment) {
      throw new Error(`No interpreter for node kind: ${node.kind}`);
    }

    const promise = fragment.visit(node, recurse);

    // Optimistically cache for concurrent dedup (Promise.all paths)
    if (!isVolatile(node)) {
      cache.set(node, promise);
    }

    const result = await promise;

    // Post-evaluation taint check
    if (isVolatile(node) || hasAnyTaintedChild(node, tainted)) {
      tainted.add(node);
      cache.delete(node);
    }

    return result;
  }

  // .fresh() creates a new recurse with empty cache/taint (for retry)
  (recurse as RecurseFn).fresh = () => composeInterpreters(fragments);

  return recurse as RecurseFn;
}
```

The return type changes from `(node: ASTNode) => Promise<unknown>` to `RecurseFn`. Since `RecurseFn` extends the call signature `(node: ASTNode): Promise<unknown>`, all existing callers remain compatible — they just call the function, ignoring `.fresh()`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts`
Expected: All 3 tests PASS

**Step 5: Run full test suite to verify no regressions**

Run: `npm run build && npm run check && npm test`
Expected: Build clean, lint clean, all 335 tests pass.

**Step 6: Commit**

```bash
git add src/core.ts tests/interpreters/dag-memoization.test.ts
git commit -m "feat: add WeakMap memoization with taint tracking to composeInterpreters"
```

---

### Task 2: Taint tracking tests (volatile nodes)

Verify that volatile nodes (`core/lambda_param`) correctly prevent caching of dependent nodes while allowing caching of independent nodes.

**Files:**
- Modify: `tests/interpreters/dag-memoization.test.ts`

**Step 1: Write taint tracking tests**

Add to `tests/interpreters/dag-memoization.test.ts`:

```typescript
import { coreInterpreter } from "../../src/interpreters/core";

describe("DAG memoization: taint tracking", () => {
  it("volatile node (lambda_param) is not cached", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    // Simulate what par_map does: lambda_param with injected value
    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 42;

    const root: ASTNode = { kind: "track/add", left: param, right: { kind: "track/value", value: 1, id: "one" }, id: "root" };

    const result = await interp(root);
    expect(result).toBe(43);

    // Now change the value and evaluate again
    (param as any).__value = 100;
    const result2 = await interp(root);
    // root depends on a volatile node, so it should re-evaluate
    expect(result2).toBe(101);
  });

  it("taint propagates: node depending on volatile is not cached", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 10;

    // chain: add -> lambda_param (volatile)
    // Both add and lambda_param should not be cached
    const addNode: ASTNode = { kind: "track/add", left: param, right: { kind: "track/value", value: 5, id: "five" }, id: "add" };
    // stable is independent of the volatile chain
    const stable: ASTNode = { kind: "track/value", value: 99, id: "stable" };
    const root: ASTNode = { kind: "track/pair", a: addNode, b: stable, id: "root" };

    await interp(root);
    expect(visitCount.get("stable")).toBe(1);

    // Re-evaluate: stable should be cached, add should re-evaluate
    (param as any).__value = 20;
    const result2 = await interp(root);
    expect(result2).toEqual([25, 99]);
    expect(visitCount.get("stable")).toBe(1); // still 1 — cached
    expect(visitCount.get("add")).toBe(2); // re-evaluated
  });

  it("independent branch is cached even when sibling is tainted", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 1;

    const taintedBranch: ASTNode = { kind: "track/add", left: param, right: { kind: "track/value", value: 0, id: "zero" }, id: "tainted" };
    const stableBranch: ASTNode = { kind: "track/value", value: 42, id: "stable" };
    const root: ASTNode = { kind: "track/pair", a: taintedBranch, b: stableBranch, id: "root" };

    await interp(root);
    (param as any).__value = 2;
    await interp(root);
    (param as any).__value = 3;
    await interp(root);

    expect(visitCount.get("tainted")).toBe(3); // re-evaluated each time
    expect(visitCount.get("stable")).toBe(1);  // cached from first evaluation
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts`
Expected: All 6 tests PASS (3 from Task 1 + 3 new)

**Step 3: Commit**

```bash
git add tests/interpreters/dag-memoization.test.ts
git commit -m "test: add taint tracking tests for volatile nodes and propagation"
```

---

### Task 3: Update retry to use recurse.fresh()

Modify the `fiber/retry` handler to create a fresh recurse per attempt, ensuring failed attempts don't pollute the cache.

**Files:**
- Modify: `src/plugins/fiber/interpreter.ts:65-80`
- Modify: `tests/interpreters/dag-memoization.test.ts`

**Step 1: Write failing retry re-execution test**

Add to `tests/interpreters/dag-memoization.test.ts`:

```typescript
import { fiberInterpreter } from "../../src/plugins/fiber/interpreter";
import { errorInterpreter } from "../../src/plugins/error/interpreter";

describe("DAG memoization: retry with fresh cache", () => {
  it("retry re-executes on each attempt (not cached)", async () => {
    let callCount = 0;
    const sideEffectFragment: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/call",
      async visit(node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
        callCount++;
        if (callCount < 3) throw new Error("not yet");
        return "success";
      },
    };

    const interp = composeInterpreters([
      sideEffectFragment,
      fiberInterpreter,
      errorInterpreter,
      coreInterpreter,
    ]);

    const result = await interp({
      kind: "fiber/retry",
      expr: { kind: "fx/call" },
      attempts: 5,
      delay: 0,
    });

    expect(result).toBe("success");
    expect(callCount).toBe(3); // called 3 times, not 1
  });

  it("retry exhausts attempts when all fail", async () => {
    let callCount = 0;
    const alwaysFails: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/call",
      async visit() {
        callCount++;
        throw new Error("always fails");
      },
    };

    const interp = composeInterpreters([
      alwaysFails,
      fiberInterpreter,
      errorInterpreter,
      coreInterpreter,
    ]);

    await expect(
      interp({ kind: "fiber/retry", expr: { kind: "fx/call" }, attempts: 3, delay: 0 }),
    ).rejects.toThrow("always fails");
    expect(callCount).toBe(3);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts`
Expected: The retry tests FAIL — the memoized cache returns the cached rejected promise on subsequent attempts.

**Step 3: Update fiber/retry to use recurse.fresh()**

In `src/plugins/fiber/interpreter.ts`, modify the retry case (around line 65):

```typescript
      case "fiber/retry": {
        const attempts = node.attempts as number;
        const delay = (node.delay as number) ?? 0;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            const attemptRecurse = (recurse as any).fresh
              ? (recurse as any).fresh()
              : recurse;
            return await attemptRecurse(node.expr as ASTNode);
          } catch (e) {
            lastError = e;
            if (i < attempts - 1 && delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }
```

The `(recurse as any).fresh ? ... : recurse` guard ensures backward compatibility if `recurse` doesn't have `.fresh()` (e.g., in tests that build recurse manually).

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts`
Expected: All tests pass including the new retry tests.

**Step 5: Run full suite**

Run: `npm run build && npm run check && npm test`
Expected: All clean.

**Step 6: Commit**

```bash
git add src/plugins/fiber/interpreter.ts tests/interpreters/dag-memoization.test.ts
git commit -m "feat: retry uses fresh cache per attempt for correct re-execution"
```

---

### Task 4: Cursor without cloning

Stop using `structuredClone` in the cursor handler. Instead, locate the `cursor_batch` node upfront and set `__batchData` directly before each iteration. Taint tracking handles the rest.

**Files:**
- Modify: `src/plugins/postgres/3.4.8/interpreter.ts:147-193`
- Create: `tests/interpreters/dag-memoization-integration.test.ts`

**Step 1: Write failing test for cursor with shared external query**

Create `tests/interpreters/dag-memoization-integration.test.ts`:

```typescript
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ASTNode, InterpreterFragment } from "../../src/core";
import { composeInterpreters, mvfm } from "../../src/core";
import { coreInterpreter } from "../../src/interpreters/core";
import { eq } from "../../src/plugins/eq";
import { eqInterpreter } from "../../src/plugins/eq/interpreter";
import { error } from "../../src/plugins/error";
import { errorInterpreter } from "../../src/plugins/error/interpreter";
import { fiber } from "../../src/plugins/fiber";
import { fiberInterpreter } from "../../src/plugins/fiber/interpreter";
import { num } from "../../src/plugins/num";
import { numInterpreter } from "../../src/plugins/num/interpreter";
import { ord } from "../../src/plugins/ord";
import { ordInterpreter } from "../../src/plugins/ord/interpreter";
import { postgres as pgPlugin } from "../../src/plugins/postgres/3.4.8";
import { wrapPostgresJs } from "../../src/plugins/postgres/3.4.8/client-postgres-js";
import { postgresInterpreter } from "../../src/plugins/postgres/3.4.8/interpreter";
import { semiring } from "../../src/plugins/semiring";
import { str } from "../../src/plugins/str";
import { strInterpreter } from "../../src/plugins/str/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;
let queryCount: number;

const nonPgFragments = [
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  ordInterpreter,
  eqInterpreter,
  strInterpreter,
];

/**
 * A wrapping PostgresClient that counts query executions.
 */
function makeCountingClient() {
  const inner = wrapPostgresJs(sql);
  queryCount = 0;
  return {
    async query(sqlStr: string, params: unknown[]) {
      queryCount++;
      return inner.query(sqlStr, params);
    },
    begin: inner.begin,
    savepoint: inner.savepoint,
    async cursor(
      sqlStr: string,
      params: unknown[],
      batchSize: number,
      fn: (rows: unknown[]) => Promise<undefined | false>,
    ) {
      queryCount++;
      return inner.cursor(sqlStr, params, batchSize, fn);
    },
  };
}

function makeInterp() {
  const client = makeCountingClient();
  return composeInterpreters([postgresInterpreter(client, nonPgFragments), ...nonPgFragments]);
}

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = makeInterp();
  return await interp(ast.result);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`;
  await sql`INSERT INTO settings (key, value) VALUES ('tax_rate', '0.08')`;
  await sql`CREATE TABLE big_table (id SERIAL PRIMARY KEY, data TEXT)`;
  // Insert enough rows for multiple cursor batches
  for (let i = 0; i < 10; i++) {
    await sql`INSERT INTO big_table (data) VALUES (${`row-${i}`})`;
  }
  await sql`CREATE TABLE processed (id SERIAL PRIMARY KEY, data TEXT, tax_rate TEXT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

describe("DAG memoization: shared query deduplication (integration)", () => {
  it("shared query used by two consumers executes once", async () => {
    // Both branches reference the same settings query
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      const a = $.sql`SELECT ${settings[0].value} as rate`;
      const b = $.sql`SELECT ${settings[0].value} as rate2`;
      return $.do(a, b);
    });
    const result = await run(prog);
    // The settings query should only execute once, not twice
    // queryCount: 1 (settings) + 1 (a) + 1 (b) = 3
    // Without memoization it would be: 2 (settings) + 1 (a) + 1 (b) = 4
    expect(queryCount).toBe(3);
  });
});

describe("DAG memoization: cursor with shared external query", () => {
  it("external query is cached across cursor iterations", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      return $.sql.cursor(
        $.sql`SELECT * FROM big_table`,
        5, // batch size of 5 → 2 iterations for 10 rows
        (batch) => {
          return $.sql`INSERT INTO processed (data, tax_rate)
            SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`;
        },
      );
    });
    await run(prog);
    // queryCount breakdown:
    // 1: cursor query (SELECT * FROM big_table)
    // 1: settings query (SELECT value FROM settings) — cached across iterations
    // 2: INSERT queries (one per batch iteration)
    // Total: 4
    // Without memoization: settings would run once per iteration = 1 + 2 + 2 = 5
    expect(queryCount).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/interpreters/dag-memoization-integration.test.ts`
Expected: The "shared query used by two consumers" test may already pass (if both consumers run sequentially and the first caches). The cursor test will FAIL because `structuredClone` breaks node identity.

**Step 3: Update cursor handler to stop cloning**

In `src/plugins/postgres/3.4.8/interpreter.ts`, replace `injectCursorBatch` with `findCursorBatch` and update the cursor case:

Replace the `injectCursorBatch` function (around line 179-193) with:

```typescript
function findCursorBatch(node: any): ASTNode | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCursorBatch(item);
      if (found) return found;
    }
    return null;
  }
  if (node.kind === "postgres/cursor_batch") return node;
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      const found = findCursorBatch(v);
      if (found) return found;
    }
  }
  return null;
}
```

Replace the cursor case (around line 147-159) with:

```typescript
        case "postgres/cursor": {
          const queryNode = node.query as ASTNode;
          const { sql, params } = await buildSQL(queryNode, recurse);
          const batchSize = (await recurse(node.batchSize as ASTNode)) as number;
          const batchNode = findCursorBatch(node.body as ASTNode);

          await client.cursor(sql, params, batchSize, async (rows) => {
            if (batchNode) {
              (batchNode as any).__batchData = rows;
            }
            await recurse(node.body as ASTNode);
            return undefined;
          });
          return;
        }
```

Remove the old `injectCursorBatch` function entirely.

**Step 4: Run tests**

Run: `npx vitest run tests/interpreters/dag-memoization-integration.test.ts`
Expected: Both integration tests PASS.

**Step 5: Run full suite to check for regressions**

Run: `npm run build && npm run check && npm test`
Expected: All clean. Existing cursor tests in `tests/plugins/postgres/3.4.8/interpreter.test.ts` should still pass because cursor_batch is volatile (never cached) and batch data is still injected before each iteration.

**Step 6: Commit**

```bash
git add src/plugins/postgres/3.4.8/interpreter.ts tests/interpreters/dag-memoization-integration.test.ts
git commit -m "feat: cursor stops cloning, uses memoization with taint tracking"
```

---

### Task 5: Adversarial tests

Write tests that try to break the memoization in edge cases.

**Files:**
- Modify: `tests/interpreters/dag-memoization.test.ts`
- Modify: `tests/interpreters/dag-memoization-integration.test.ts`

**Step 1: Add adversarial unit tests**

Add to `tests/interpreters/dag-memoization.test.ts`:

```typescript
describe("DAG memoization: adversarial cases", () => {
  it("same node referenced in both tainted and untainted positions", async () => {
    // shared is used both as a sibling to a volatile node (tainted path)
    // and independently (untainted path). Should be cached.
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    const shared: ASTNode = { kind: "track/value", value: 42, id: "shared" };
    const param: ASTNode = { kind: "core/lambda_param", name: "x" } as any;
    (param as any).__value = 1;

    // tainted path: add(param, shared)
    const taintedUse: ASTNode = { kind: "track/add", left: param, right: shared, id: "tainted-use" };
    // untainted path: add(shared, literal)
    const cleanUse: ASTNode = { kind: "track/add", left: shared, right: { kind: "track/value", value: 0, id: "zero" }, id: "clean-use" };
    const root: ASTNode = { kind: "track/pair", a: taintedUse, b: cleanUse, id: "root" };

    const result = await interp(root);
    expect(result).toEqual([43, 42]);
    expect(visitCount.get("shared")).toBe(1); // cached, used in both paths

    // Change volatile, re-evaluate
    (param as any).__value = 100;
    const result2 = await interp(root);
    expect(result2).toEqual([142, 42]);
    expect(visitCount.get("shared")).toBe(1); // still cached
    expect(visitCount.get("tainted-use")).toBe(2); // re-evaluated
    expect(visitCount.get("clean-use")).toBe(1); // cached
  });

  it("long prop_access chain is fully cached", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([coreInterpreter, fragment]);

    // Simulate: config[0].items[0].name via nested prop_access
    const query: ASTNode = { kind: "track/value", value: [{ items: [{ name: "hello" }] }], id: "query" };
    const access0: ASTNode = { kind: "core/prop_access", object: query, property: 0 };
    const accessItems: ASTNode = { kind: "core/prop_access", object: access0, property: "items" };
    const accessItem0: ASTNode = { kind: "core/prop_access", object: accessItems, property: 0 };
    const accessName: ASTNode = { kind: "core/prop_access", object: accessItem0, property: "name" };

    // Use the end of the chain twice
    const root: ASTNode = { kind: "track/pair", a: accessName, b: accessName, id: "root" };

    const result = await interp(root);
    expect(result).toEqual(["hello", "hello"]);
    expect(visitCount.get("query")).toBe(1);
  });

  it("cache handles rejected promises correctly", async () => {
    let callCount = 0;
    const failOnce: InterpreterFragment = {
      pluginName: "fx",
      canHandle: (node) => node.kind === "fx/flaky",
      async visit() {
        callCount++;
        throw new Error("boom");
      },
    };

    const interp = composeInterpreters([failOnce, coreInterpreter]);

    const node: ASTNode = { kind: "fx/flaky" };
    await expect(interp(node)).rejects.toThrow("boom");
    // Calling again with the same node should return cached rejected promise
    await expect(interp(node)).rejects.toThrow("boom");
    expect(callCount).toBe(1); // cached, not re-executed
  });

  it("deeply nested shared node in parallel branches", async () => {
    const { fragment, visitCount } = createTrackingFragment();
    const interp = composeInterpreters([fragment]);

    const deep: ASTNode = { kind: "track/value", value: 1, id: "deep" };
    const mid1: ASTNode = { kind: "track/add", left: deep, right: { kind: "track/value", value: 2, id: "l2a" }, id: "mid1" };
    const mid2: ASTNode = { kind: "track/add", left: deep, right: { kind: "track/value", value: 3, id: "l2b" }, id: "mid2" };
    // mid1 and mid2 share "deep", run in parallel
    const root: ASTNode = { kind: "track/parallel", elements: [mid1, mid2], id: "root" };

    const result = await interp(root);
    expect(result).toEqual([3, 4]);
    expect(visitCount.get("deep")).toBe(1);
  });
});
```

**Step 2: Add adversarial integration tests**

Add to `tests/interpreters/dag-memoization-integration.test.ts`:

```typescript
describe("DAG memoization: adversarial integration tests", () => {
  it("cursor inside retry: retry re-runs entire cursor with fresh cache", async () => {
    let cursorRunCount = 0;

    // We can't easily make a cursor fail mid-batch, but we can verify
    // that retry creates fresh caches by counting query executions.
    // A cursor that completes should cache its internal queries.
    // Under retry, each attempt should start fresh.
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      // Wrap cursor in a retry — even though cursor won't fail here,
      // the settings query should NOT be shared across retry boundary
      return $.retry(
        $.sql.cursor(
          $.sql`SELECT * FROM big_table ORDER BY id LIMIT 4`,
          2,
          (batch) =>
            $.sql`INSERT INTO processed (data, tax_rate)
              SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`,
        ),
        { attempts: 2, delay: 0 },
      );
    });
    await run(prog);
    // With fresh cache per retry attempt:
    // Attempt 1: 1 cursor + 1 settings + 2 inserts = 4 queries
    // (cursor succeeds, so only 1 attempt)
    expect(queryCount).toBe(4);
  });

  it("same query used inside and outside cursor", async () => {
    const prog = app(($) => {
      const settings = $.sql`SELECT value FROM settings WHERE key = 'tax_rate'`;
      // Use settings outside cursor
      const rateCheck = $.sql`SELECT ${settings[0].value} as rate`;
      // Use settings inside cursor too
      const cursorResult = $.sql.cursor(
        $.sql`SELECT * FROM big_table ORDER BY id LIMIT 4`,
        2,
        (batch) =>
          $.sql`INSERT INTO processed (data, tax_rate)
            SELECT unnest(ARRAY[${batch[0].data}]), ${settings[0].value}`,
      );
      return $.do(rateCheck, cursorResult, settings);
    });
    const result = await run(prog);
    // settings query: evaluated once (cached), used by rateCheck and inside cursor
    // rateCheck: 1 query
    // cursor: 1 cursor query + 2 insert queries
    // settings result returned as final value
    // Total: 1 (settings) + 1 (rateCheck) + 1 (cursor) + 2 (inserts) = 5
    expect(queryCount).toBe(5);
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/interpreters/dag-memoization.test.ts tests/interpreters/dag-memoization-integration.test.ts`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add tests/interpreters/dag-memoization.test.ts tests/interpreters/dag-memoization-integration.test.ts
git commit -m "test: add adversarial tests for memoization edge cases"
```

---

### Task 6: Full validation

Run complete build, lint, and test suite. Fix any issues.

**Files:**
- Possibly any file that needs fixing

**Step 1: Full validation**

Run: `npm run build && npm run check && npm test`
Expected: Build clean, lint clean, all tests pass.

**Step 2: Verify the `RecurseFn` export**

The `RecurseFn` type is exported from `src/core.ts` and re-exported via `src/index.ts`. Verify it's accessible:

Run: `grep -n "RecurseFn" src/index.ts`

If not exported, add it to the exports in `src/index.ts`.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: validation fixes for memoized DAG evaluation"
```

Only create this commit if there were actual fixes needed.
