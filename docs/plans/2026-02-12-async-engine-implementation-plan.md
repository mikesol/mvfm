# Async Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the interpreter engine uniformly async so `recurse` always returns `Promise<unknown>`, eliminating per-node thenable detection and enabling cross-plugin async composition.

**Architecture:** Change `InterpreterFragment.visit` to async, `composeInterpreters` to return `(node) => Promise<unknown>`. Migrate all 9 interpreters (core + 8 plugins) mechanically. Narrow fiber to concurrency control only (`$.seq()`/`$.par()` emit core nodes). Add integration tests for cross-plugin async patterns.

**Tech Stack:** TypeScript, vitest, testcontainers (for postgres integration tests)

---

### Task 1: Update `InterpreterFragment` interface and `composeInterpreters`

**Files:**
- Modify: `src/core.ts:156-183`

**Step 1: Write the failing test**

Create `tests/interpreters/async-engine.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { composeInterpreters } from "../../src/core";
import type { ASTNode, InterpreterFragment } from "../../src/core";

describe("async engine: composeInterpreters", () => {
  it("returns a function that returns a Promise", async () => {
    const fragment: InterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/literal",
      async visit(node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
        return node.value;
      },
    };
    const interp = composeInterpreters([fragment]);
    const result = interp({ kind: "test/literal", value: 42 });
    // Must be a Promise
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(42);
  });

  it("recurse passes Promises between fragments", async () => {
    const inner: InterpreterFragment = {
      pluginName: "inner",
      canHandle: (node) => node.kind === "inner/value",
      async visit(node: ASTNode, _recurse: (n: ASTNode) => Promise<unknown>) {
        return node.value;
      },
    };
    const outer: InterpreterFragment = {
      pluginName: "outer",
      canHandle: (node) => node.kind === "outer/double",
      async visit(node: ASTNode, recurse: (n: ASTNode) => Promise<unknown>) {
        const val = (await recurse(node.inner as ASTNode)) as number;
        return val * 2;
      },
    };
    const interp = composeInterpreters([outer, inner]);
    const result = await interp({
      kind: "outer/double",
      inner: { kind: "inner/value", value: 21 },
    });
    expect(result).toBe(42);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/interpreters/async-engine.test.ts`
Expected: FAIL — existing `InterpreterFragment` type doesn't match async signatures.

**Step 3: Update `InterpreterFragment` and `composeInterpreters`**

In `src/core.ts`, change the `InterpreterFragment` interface (around line 162):

```typescript
export interface InterpreterFragment {
  pluginName: string;
  visit: (node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>;
  canHandle: (node: ASTNode) => boolean;
}
```

Change `composeInterpreters` (around line 175):

```typescript
export function composeInterpreters(
  fragments: InterpreterFragment[],
): (node: ASTNode) => Promise<unknown> {
  async function recurse(node: ASTNode): Promise<unknown> {
    const fragment = fragments.find((f) => f.canHandle(node));
    if (!fragment) {
      throw new Error(`No interpreter for node kind: ${node.kind}`);
    }
    return await fragment.visit(node, recurse);
  }
  return recurse;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/interpreters/async-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core.ts tests/interpreters/async-engine.test.ts
git commit -m "feat: make InterpreterFragment and composeInterpreters async"
```

---

### Task 2: Migrate core interpreter to async

**Files:**
- Modify: `src/interpreters/core.ts`
- Modify: `tests/interpreters/core.test.ts`

**Step 1: Update the core interpreter**

Replace the entire `visit` function in `src/interpreters/core.ts`. The key changes:
- Add `async` to `visit`
- Change `recurse` param type to `(node: ASTNode) => Promise<unknown>`
- `await recurse(...)` everywhere
- `core/tuple` uses `Promise.all`
- `core/record` uses `Promise.all`
- Remove ALL thenable detection code

```typescript
import type { ASTNode, InterpreterFragment } from "../core";

export const coreInterpreter: InterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = (await recurse(node.object as ASTNode)) as Record<string, unknown>;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const entries = Object.entries(fields);
        const values = await Promise.all(entries.map(([, fieldNode]) => recurse(fieldNode)));
        const result: Record<string, unknown> = {};
        for (let i = 0; i < entries.length; i++) {
          result[entries[i][0]] = values[i];
        }
        return result;
      }

      case "core/cond": {
        const predicate = await recurse(node.predicate as ASTNode);
        return predicate
          ? await recurse(node.then as ASTNode)
          : await recurse(node.else as ASTNode);
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        for (const step of steps) {
          await recurse(step);
        }
        return await recurse(node.result as ASTNode);
      }

      case "core/program":
        return await recurse(node.result as ASTNode);

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        return await Promise.all(elements.map((el) => recurse(el)));
      }

      case "core/lambda_param":
        return (node as any).__value;

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 2: Update `tests/interpreters/core.test.ts`**

The `run()` function needs to return `await interp(...)` since interp now returns Promise. Also, test call sites using `expect(run(prog))` need `await`.

Change the `run` function to:
```typescript
async function run(prog: { ast: any }) {
  return await interp(prog.ast.result);
}
```

Change all `expect(run(prog))` to `expect(await run(prog))`.

**Step 3: Run tests**

Run: `npx vitest run tests/interpreters/core.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/interpreters/core.ts tests/interpreters/core.test.ts
git commit -m "feat: migrate core interpreter to async with Promise.all for tuple/record"
```

---

### Task 3: Migrate num, eq, ord, boolean interpreters to async

**Files:**
- Modify: `src/plugins/num/interpreter.ts`
- Modify: `src/plugins/eq/interpreter.ts`
- Modify: `src/plugins/ord/interpreter.ts`
- Modify: `src/plugins/boolean/interpreter.ts`
- Modify: `tests/plugins/num/interpreter.test.ts`
- Modify: `tests/plugins/eq/interpreter.test.ts`
- Modify: `tests/plugins/ord/interpreter.test.ts`
- Modify: `tests/plugins/heyting-algebra/interpreter.test.ts`

**Step 1: Migrate interpreters**

For each interpreter, the change is mechanical:
- Add `async` to `visit`
- Change `recurse` param type to `(node: ASTNode) => Promise<unknown>`
- Add `await` before every `recurse(...)` call

Example for num (the most complex). Every `recurse(node.left as ASTNode) as number` becomes `(await recurse(node.left as ASTNode)) as number`. For min/max with `.map()`:
```typescript
case "num/min": {
  const values = await Promise.all((node.values as ASTNode[]).map((v) => recurse(v)));
  return Math.min(...(values as number[]));
}
```

For eq interpreter: `await recurse(node.inner as ASTNode)` with `!` applied to the result.

For ord interpreter: `await recurse(node.operand as ASTNode)` at the top.

For boolean interpreter: `await recurse(...)` on every operand. Note: short-circuit evaluation for `and`/`or`/`implies` must be preserved — evaluate left first, only evaluate right if needed:
```typescript
case "boolean/and": {
  const left = (await recurse(node.left as ASTNode)) as boolean;
  return left ? (await recurse(node.right as ASTNode)) as boolean : false;
}
```

**Step 2: Update test files**

For each test file, update `run()` to be async and add `await` at call sites:
- `tests/plugins/num/interpreter.test.ts`: `run()` → `async run()` with `await interp(...)`. Change `expect(run(prog))` → `expect(await run(prog))`. Also update the standalone `interp(ast)` calls on lines 66, 74, 80 to `await interp(ast)`.
- `tests/plugins/eq/interpreter.test.ts`: same pattern.
- `tests/plugins/ord/interpreter.test.ts`: same pattern.
- `tests/plugins/heyting-algebra/interpreter.test.ts`: same pattern (uses booleanInterpreter).

**Step 3: Run tests**

Run: `npx vitest run tests/plugins/num tests/plugins/eq tests/plugins/ord tests/plugins/heyting-algebra`
Expected: PASS

**Step 4: Commit**

```bash
git add src/plugins/num/interpreter.ts src/plugins/eq/interpreter.ts src/plugins/ord/interpreter.ts src/plugins/boolean/interpreter.ts tests/plugins/num tests/plugins/eq tests/plugins/ord tests/plugins/heyting-algebra
git commit -m "feat: migrate num, eq, ord, boolean interpreters to async"
```

---

### Task 4: Migrate str interpreter to async

**Files:**
- Modify: `src/plugins/str/interpreter.ts`
- Modify: `tests/plugins/str/interpreter.test.ts`
- Modify: `tests/plugins/semigroup/interpreter.test.ts`
- Modify: `tests/plugins/show/interpreter.test.ts`
- Modify: `tests/plugins/semiring/interpreter.test.ts`

**Step 1: Migrate str interpreter**

Same mechanical change: `async visit`, `await recurse(...)`.

For `str/template`, the loop becomes:
```typescript
case "str/template": {
  const strings = node.strings as string[];
  const exprs = node.exprs as ASTNode[];
  let result = strings[0];
  for (let i = 0; i < exprs.length; i++) {
    result += String(await recurse(exprs[i]));
    result += strings[i + 1];
  }
  return result;
}
```

For `str/concat`:
```typescript
case "str/concat": {
  const parts = node.parts as ASTNode[];
  const resolved = await Promise.all(parts.map((p) => recurse(p)));
  return (resolved as string[]).join("");
}
```

**Step 2: Update test files**

- `tests/plugins/str/interpreter.test.ts`: `run()` → `async`, add `await`. Also lines 53, 65, 73 have standalone `interp(ast)` calls — add `await`.
- `tests/plugins/semigroup/interpreter.test.ts`: `run()` → `async`, add `await`.
- `tests/plugins/show/interpreter.test.ts`: `run()` → `async`, add `await`.
- `tests/plugins/semiring/interpreter.test.ts`: `run()` → `async`, add `await`.

**Step 3: Run tests**

Run: `npx vitest run tests/plugins/str tests/plugins/semigroup tests/plugins/show tests/plugins/semiring`
Expected: PASS

**Step 4: Commit**

```bash
git add src/plugins/str/interpreter.ts tests/plugins/str tests/plugins/semigroup tests/plugins/show tests/plugins/semiring
git commit -m "feat: migrate str interpreter to async"
```

---

### Task 5: Migrate error interpreter to async

**Files:**
- Modify: `src/plugins/error/interpreter.ts`
- Modify: `tests/plugins/error/interpreter.test.ts`

**Step 1: Migrate error interpreter**

The error interpreter already uses `async` internally (wrapping in `async () => { ... }` IIFEs). The change is:
- Make `visit` itself `async`
- Change `recurse` param type
- Replace `Promise.resolve(recurse(...))` with just `await recurse(...)` (simpler since recurse now returns Promise)
- Remove the IIFE wrappers (`async () => { ... }; return expr();`) — visit is already async, just use `await` directly

For example, `error/try` simplifies from:
```typescript
case "error/try": {
  const tryExpr = async () => { try { ... } };
  return tryExpr();
}
```
to:
```typescript
case "error/try": {
  try {
    return await recurse(node.expr as ASTNode);
  } catch (e) {
    ...
  }
}
```

For `error/settle`, use `Promise.allSettled(exprs.map((e) => recurse(e)))` directly — no `Promise.resolve` wrapping needed since `recurse` already returns Promise.

**Step 2: Update test file**

`tests/plugins/error/interpreter.test.ts`: The `run()` function already uses `await Promise.resolve(interp(...))`. Change to just `await interp(...)`. Test call sites already use `await run(prog)` — no changes needed there.

**Step 3: Run tests**

Run: `npx vitest run tests/plugins/error`
Expected: PASS

**Step 4: Commit**

```bash
git add src/plugins/error/interpreter.ts tests/plugins/error
git commit -m "feat: migrate error interpreter to async, remove IIFE wrappers"
```

---

### Task 6: Migrate fiber interpreter — narrow to concurrency control

**Files:**
- Modify: `src/plugins/fiber/interpreter.ts`
- Modify: `src/plugins/fiber/index.ts`
- Modify: `tests/plugins/fiber/interpreter.test.ts`

**Step 1: Update fiber plugin AST emission**

In `src/plugins/fiber/index.ts`, change `$.seq()` to emit `core/do` and `$.par()` (tuple form) to emit `core/tuple`:

For `seq()` (around line 174):
```typescript
seq(...exprs: (Expr<any> | any)[]) {
  const nodes = exprs.map((e) => (ctx.isExpr(e) ? e.__node : ctx.lift(e).__node));
  const steps = nodes.slice(0, -1);
  const result = nodes[nodes.length - 1];
  return ctx.expr({
    kind: "core/do",
    steps,
    result,
  });
},
```

For `par` tuple form (around line 165):
```typescript
// Tuple form: $.par(a, b, c)
return ctx.expr({
  kind: "core/tuple",
  elements: args.map((a: any) => (ctx.isExpr(a) ? a.__node : ctx.lift(a).__node)),
});
```

Update `nodeKinds` — remove `"fiber/par"` and `"fiber/seq"` since they no longer emit those kinds.

**Step 2: Update fiber interpreter**

In `src/plugins/fiber/interpreter.ts`:
- Make `visit` async, update `recurse` param type
- Remove `fiber/par` and `fiber/seq` handlers (now handled by core)
- Simplify remaining handlers to use `await recurse(...)` instead of `Promise.resolve(recurse(...))`

```typescript
export const fiberInterpreter: InterpreterFragment = {
  pluginName: "fiber",
  canHandle: (node) => node.kind.startsWith("fiber/"),
  async visit(node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>): Promise<unknown> {
    switch (node.kind) {
      case "fiber/par_map": {
        const collection = (await recurse(node.collection as ASTNode)) as unknown[];
        const concurrency = node.concurrency as number;
        const param = node.param as ASTNode;
        const body = node.body as ASTNode;

        const results: unknown[] = [];
        for (let i = 0; i < collection.length; i += concurrency) {
          const batch = collection.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map((item) => {
              const bodyClone = structuredClone(body);
              injectLambdaParam(bodyClone, (param as any).name, item);
              return recurse(bodyClone);
            }),
          );
          results.push(...batchResults);
        }
        return results;
      }

      case "fiber/race": {
        const branches = node.branches as ASTNode[];
        return Promise.race(branches.map((b) => recurse(b)));
      }

      case "fiber/timeout": {
        const ms = (await recurse(node.ms as ASTNode)) as number;
        const fallback = () => recurse(node.fallback as ASTNode);
        const expr = recurse(node.expr as ASTNode);
        let timerId: ReturnType<typeof setTimeout>;
        const timer = new Promise<unknown>((resolve) => {
          timerId = setTimeout(async () => resolve(await fallback()), ms);
        });
        return Promise.race([expr, timer]).finally(() => clearTimeout(timerId!));
      }

      case "fiber/retry": {
        const attempts = node.attempts as number;
        const delay = (node.delay as number) ?? 0;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            return await recurse(node.expr as ASTNode);
          } catch (e) {
            lastError = e;
            if (i < attempts - 1 && delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }

      default:
        throw new Error(`Fiber interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 3: Update fiber test file**

`tests/plugins/fiber/interpreter.test.ts`:
- Change `run()` to use `await interp(...)` instead of `await Promise.resolve(interp(...))`
- Update par tests: `$.par(a, b)` now produces `core/tuple` — the core interpreter handles it. Tests should still pass since the interpreter stack includes `coreInterpreter`.
- Update seq tests: `$.seq(a, b, result)` now produces `core/do` — same, handled by core.
- All other tests (race, timeout, retry, par_map) should pass with mechanical changes.

**Step 4: Run tests**

Run: `npx vitest run tests/plugins/fiber`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/fiber/interpreter.ts src/plugins/fiber/index.ts tests/plugins/fiber
git commit -m "feat: narrow fiber to concurrency control, seq/par emit core nodes"
```

---

### Task 7: Migrate postgres interpreter to async

**Files:**
- Modify: `src/plugins/postgres/3.4.8/interpreter.ts`
- Modify: `tests/plugins/postgres/3.4.8/interpreter.test.ts`

**Step 1: Migrate postgres interpreter**

Key changes:
- Make `visit` async, update `recurse` param type
- Make `buildSQL` async — every `recurse(param)` becomes `await recurse(param)`
- The `visit` handler for `postgres/query` becomes `await buildSQL(node, recurse)` (since buildSQL is now async)
- Remove IIFE wrappers on begin/savepoint/cursor — visit is async
- Transaction scoping: `composeInterpreters` now returns async `(node) => Promise<unknown>`, so `txRecurse` is already async. Replace `await Promise.resolve(txRecurse(q))` with `await txRecurse(q)`.

`buildSQL` becomes:
```typescript
async function buildSQL(
  node: ASTNode,
  recurse: (n: ASTNode) => Promise<unknown>,
): Promise<BuiltQuery> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = (await recurse(param.name as ASTNode)) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (await recurse(param.data as ASTNode)) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns =
          (param.columns as string[] | null) ?? Object.keys(Array.isArray(data) ? data[0] : data);
        const rows = Array.isArray(data) ? data : [data];
        sql +=
          "(" +
          columns.map(escapeIdentifier).join(",") +
          ") values " +
          rows
            .map(
              (row) =>
                "(" +
                columns
                  .map((col) => {
                    params.push(row[col]);
                    return `$${params.length}`;
                  })
                  .join(",") +
                ")",
            )
            .join(",");
      } else if (param.kind === "postgres/set_helper") {
        const data = (await recurse(param.data as ASTNode)) as Record<string, unknown>;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return `${escapeIdentifier(col)}=$${params.length}`;
          })
          .join(",");
      } else {
        params.push(await recurse(param));
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}
```

**Step 2: Update postgres test file**

`tests/plugins/postgres/3.4.8/interpreter.test.ts`:
- Change `makeInterp()` — `composeInterpreters` now returns `(node) => Promise<unknown>`. The `run()` function already does `await Promise.resolve(interp(ast.result))` — change to `await interp(ast.result)`.

**Step 3: Run tests**

Run: `npx vitest run tests/plugins/postgres`
Expected: PASS (requires Docker for testcontainers — skip if not available, but note it)

**Step 4: Commit**

```bash
git add src/plugins/postgres/3.4.8/interpreter.ts tests/plugins/postgres
git commit -m "feat: migrate postgres interpreter to async, buildSQL now awaits recurse"
```

---

### Task 8: Add cross-plugin async composition tests

These are the tests that were **impossible before** and motivated this entire change.

**Files:**
- Create: `tests/interpreters/async-composition.test.ts`

**Step 1: Write the tests**

```typescript
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../src/core";
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

const nonPgFragments = [
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  ordInterpreter,
  eqInterpreter,
  strInterpreter,
];

function makeInterp() {
  const client = wrapPostgresJs(sql);
  return composeInterpreters([postgresInterpreter(client, nonPgFragments), ...nonPgFragments]);
}

const app = ilo(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = makeInterp();
  return await interp(ast.result);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INT)`;
  await sql`INSERT INTO products (name, price) VALUES ('Widget', 100), ('Gadget', 200), ('Doohickey', 50)`;
  await sql`CREATE TABLE orders (id SERIAL PRIMARY KEY, product_id INT, quantity INT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

describe("async composition: query chaining", () => {
  it("result of one query used as parameter to another", async () => {
    const prog = app(($) => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return $.sql`SELECT * FROM products WHERE price > ${product[0].price} ORDER BY price`;
    });
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Gadget");
  });

  it("chained prop access on query result", async () => {
    const prog = app(($) => {
      const product = $.sql`SELECT * FROM products WHERE name = ${"Widget"}`;
      return product[0].name;
    });
    const result = await run(prog);
    expect(result).toBe("Widget");
  });
});

describe("async composition: core/do with mixed async steps", () => {
  it("$.do sequences async operations from different plugins", async () => {
    const prog = app(($) => {
      return $.do(
        $.sql`INSERT INTO orders (product_id, quantity) VALUES (1, 5)`,
        $.sql`INSERT INTO orders (product_id, quantity) VALUES (2, 3)`,
        $.sql`SELECT count(*)::int as c FROM orders`,
      );
    });
    const result = (await run(prog)) as any[];
    expect(result[0].c).toBeGreaterThanOrEqual(2);
  });
});

describe("async composition: core/record with async fields", () => {
  it("record with async field values runs in parallel", async () => {
    const prog = app(($) => ({
      products: $.sql`SELECT count(*)::int as c FROM products`,
      orders: $.sql`SELECT count(*)::int as c FROM orders`,
    }));
    const result = (await run(prog)) as any;
    expect(result.products[0].c).toBe(3);
    expect(result.orders[0].c).toBeGreaterThanOrEqual(0);
  });
});

describe("async composition: core/tuple with async elements", () => {
  it("tuple with async elements runs in parallel via Promise.all", async () => {
    const prog = app(($) =>
      $.par(
        $.sql`SELECT count(*)::int as c FROM products`,
        $.sql`SELECT count(*)::int as c FROM orders`,
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0][0].c).toBe(3);
  });
});

describe("async composition: core/cond with async predicate", () => {
  it("conditional with async predicate evaluates correct branch", async () => {
    const prog = app(($) => {
      const count = $.sql`SELECT count(*)::int as c FROM products`;
      return $.cond($.gt(count[0].c, 0)).t("has products").f("empty");
    });
    const result = await run(prog);
    expect(result).toBe("has products");
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/interpreters/async-composition.test.ts`
Expected: PASS — these patterns now work with the async engine.

**Step 3: Commit**

```bash
git add tests/interpreters/async-composition.test.ts
git commit -m "test: add cross-plugin async composition tests (query chaining, mixed do, async record/tuple/cond)"
```

---

### Task 9: Update exports and run full suite

**Files:**
- Verify: `src/index.ts` (exports should still be correct)
- Run: full build + lint + test

**Step 1: Verify exports**

Read `src/index.ts` and confirm all exports are still valid. The type of `composeInterpreters` changed return type but that's backward-compatible at the import level.

**Step 2: Run full validation**

Run: `npm run build && npm run check && npm test`
Expected: All pass. If any TypeScript errors surface from the changed `InterpreterFragment` interface, they'll be in files that reference it — fix any remaining type mismatches.

**Step 3: Commit any fixes**

If any files needed additional fixes:
```bash
git add -A
git commit -m "fix: resolve remaining type mismatches from async engine migration"
```
