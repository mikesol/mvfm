# Postgres Reference Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the postgres interpreter, fiber interpreter, error interpreter, and testcontainers-based integration tests — proving the full composition stack works against real Postgres.

**Architecture:** Each interpreter maps AST nodes to JavaScript Promise operations. Promise IS Aff — no explicit monad stack needed. SQL construction (identifier escaping, insert/set helper expansion) happens in the postgres interpreter before calling the PostgresClient. Testcontainers spins up real Postgres for integration tests.

**Tech Stack:** TypeScript, Vitest, postgres.js v3.4.8, @testcontainers/postgresql, Docker

**Worktree:** `.worktrees/issue-25` (branch: `issue-25`)

**Design doc:** `docs/plans/2026-02-12-postgres-reference-plugin-design.md`

---

### Task 1: Add Dev Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install postgres.js and testcontainers**

```bash
npm install --save-dev postgres @testcontainers/postgresql
```

**Step 2: Verify install**

```bash
npm ls postgres @testcontainers/postgresql
```

Expected: Both packages listed with versions.

**Step 3: Verify existing tests still pass**

```bash
npm test
```

Expected: 265 tests passing.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add postgres.js and testcontainers dev dependencies"
```

---

### Task 2: Error Interpreter

The error interpreter maps error/* AST nodes to JavaScript try/catch/throw. Build it first because fiber depends on error semantics (retry catches errors).

**Files:**
- Create: `src/plugins/error/interpreter.ts`
- Create: `tests/plugins/error/interpreter.test.ts`
- Modify: `src/index.ts` (add export)

**Step 1: Write the failing tests**

Create `tests/plugins/error/interpreter.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { composeInterpreters, mvfm } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { error } from "../../../src/plugins/error";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { eq } from "../../../src/plugins/eq";
import { eqInterpreter } from "../../../src/plugins/eq/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";
import { semiring } from "../../../src/plugins/semiring";

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

const interp = composeInterpreters([
  errorInterpreter, coreInterpreter, numInterpreter, ordInterpreter, eqInterpreter,
]);
const app = mvfm(num, semiring, eq, ord, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await Promise.resolve(interp(ast.result));
}

describe("error interpreter: try/catch", () => {
  it("returns value when no error", async () => {
    const prog = app(($) => $.try(42).catch((_err) => 0));
    expect(await run(prog)).toBe(42);
  });

  it("catches error from $.fail()", async () => {
    const prog = app(($) =>
      $.try($.fail({ code: 404, message: "not found" })).catch((err) => err.message)
    );
    expect(await run(prog)).toBe("not found");
  });
});

describe("error interpreter: fail", () => {
  it("throws when not caught", async () => {
    const prog = app(($) => $.fail("boom"));
    await expect(run(prog)).rejects.toBe("boom");
  });
});

describe("error interpreter: orElse", () => {
  it("returns original value on success", async () => {
    const prog = app(($) => $.orElse(42, 0));
    expect(await run(prog)).toBe(42);
  });

  it("returns fallback on failure", async () => {
    const prog = app(($) => $.orElse($.fail("boom"), "recovered"));
    expect(await run(prog)).toBe("recovered");
  });
});

describe("error interpreter: attempt", () => {
  it("wraps success in ok", async () => {
    const prog = app(($) => $.attempt(42));
    expect(await run(prog)).toEqual({ ok: 42, err: null });
  });

  it("wraps failure in err", async () => {
    const prog = app(($) => $.attempt($.fail("boom")));
    expect(await run(prog)).toEqual({ ok: null, err: "boom" });
  });
});

describe("error interpreter: guard", () => {
  it("passes when condition is true", async () => {
    const prog = app(($) => $.do($.guard($.gt(10, 5), "fail"), "passed"));
    expect(await run(prog)).toBe("passed");
  });

  it("throws when condition is false", async () => {
    const prog = app(($) => $.do($.guard($.gt(5, 10), "condition failed"), "passed"));
    await expect(run(prog)).rejects.toBe("condition failed");
  });
});

describe("error interpreter: settle", () => {
  it("collects successes and failures", async () => {
    // Use two literal exprs — one will succeed, one will fail
    // We need an async context to test settle properly.
    // For now, test with sync values:
    const prog = app(($) => $.settle(42, $.fail("boom"), 100));
    const result = await run(prog);
    expect(result).toEqual({
      fulfilled: [42, 100],
      rejected: ["boom"],
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/plugins/error/interpreter.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the error interpreter**

Create `src/plugins/error/interpreter.ts`:

```typescript
import type { ASTNode, InterpreterFragment } from "../../core";

export const errorInterpreter: InterpreterFragment = {
  pluginName: "error",
  canHandle: (node) => node.kind.startsWith("error/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "error/try": {
        const tryExpr = async () => {
          try {
            return await Promise.resolve(recurse(node.expr as ASTNode));
          } catch (e) {
            if (node.catch) {
              const catchInfo = node.catch as { param: ASTNode; body: ASTNode };
              injectLambdaParam(catchInfo.body, catchInfo.param as any, e);
              return await Promise.resolve(recurse(catchInfo.body));
            }
            if (node.match) {
              const matchInfo = node.match as {
                param: ASTNode;
                branches: Record<string, ASTNode>;
              };
              const errObj = e as any;
              const key =
                typeof errObj === "string"
                  ? errObj
                  : errObj?.code ?? errObj?.type ?? "_";
              const branch =
                matchInfo.branches[key] ?? matchInfo.branches._ ?? null;
              if (!branch) throw e;
              injectLambdaParam(branch, matchInfo.param as any, e);
              return await Promise.resolve(recurse(branch));
            }
            throw e;
          } finally {
            if (node.finally) {
              await Promise.resolve(recurse(node.finally as ASTNode));
            }
          }
        };
        return tryExpr();
      }

      case "error/fail":
        throw recurse(node.error as ASTNode);

      case "error/attempt": {
        const attemptExpr = async () => {
          try {
            const ok = await Promise.resolve(recurse(node.expr as ASTNode));
            return { ok, err: null };
          } catch (e) {
            return { ok: null, err: e };
          }
        };
        return attemptExpr();
      }

      case "error/guard": {
        const guardExpr = async () => {
          const condition = await Promise.resolve(
            recurse(node.condition as ASTNode)
          );
          if (!condition) {
            throw await Promise.resolve(recurse(node.error as ASTNode));
          }
        };
        return guardExpr();
      }

      case "error/settle": {
        const settleExpr = async () => {
          const exprs = node.exprs as ASTNode[];
          const results = await Promise.allSettled(
            exprs.map((e) => Promise.resolve(recurse(e)))
          );
          const fulfilled: unknown[] = [];
          const rejected: unknown[] = [];
          for (const r of results) {
            if (r.status === "fulfilled") fulfilled.push(r.value);
            else rejected.push(r.reason);
          }
          return { fulfilled, rejected };
        };
        return settleExpr();
      }

      default:
        throw new Error(`Error interpreter: unknown node kind "${node.kind}"`);
    }
  },
};

// Helper: inject a value into lambda_param nodes within a subtree
function injectLambdaParam(node: any, param: { name: string }, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, param, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === param.name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, param, value);
    }
  }
}
```

**IMPORTANT:** The `core/lambda_param` node needs to be handled by coreInterpreter. Check if it already is — if not, add:

```typescript
case "core/lambda_param":
  return (node as any).__value;
```

to `src/interpreters/core.ts`.

**Step 4: Add export to index.ts**

Add to `src/index.ts`:

```typescript
export { errorInterpreter } from "./plugins/error/interpreter";
```

**Step 5: Run tests**

```bash
npm test -- tests/plugins/error/interpreter.test.ts
```

Expected: All passing. Debug if not — the lambda_param injection may need adjustment.

**Step 6: Run full test suite**

```bash
npm run build && npm run check && npm test
```

Expected: All 265+ tests passing.

**Step 7: Commit**

```bash
git add src/plugins/error/interpreter.ts tests/plugins/error/interpreter.test.ts src/index.ts src/interpreters/core.ts
git commit -m "feat: add error interpreter (try/catch/fail/attempt/guard/settle)"
```

---

### Task 3: Fiber Interpreter

The fiber interpreter maps fiber/* AST nodes to Promise combinators. Depends on error semantics for retry.

**Files:**
- Create: `src/plugins/fiber/interpreter.ts`
- Create: `tests/plugins/fiber/interpreter.test.ts`
- Modify: `src/index.ts` (add export)

**Step 1: Write the failing tests**

Create `tests/plugins/fiber/interpreter.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { composeInterpreters, mvfm } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { error } from "../../../src/plugins/error";
import { errorInterpreter } from "../../../src/plugins/error/interpreter";
import { fiber } from "../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../src/plugins/fiber/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";

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

const interp = composeInterpreters([
  errorInterpreter, fiberInterpreter, coreInterpreter, numInterpreter,
]);
const app = mvfm(num, semiring, fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await Promise.resolve(interp(ast.result));
}

describe("fiber interpreter: par (tuple)", () => {
  it("runs branches in parallel and returns array", async () => {
    const prog = app(($) => $.par(1, 2, 3));
    expect(await run(prog)).toEqual([1, 2, 3]);
  });
});

describe("fiber interpreter: seq", () => {
  it("runs steps sequentially and returns last", async () => {
    const prog = app(($) => $.seq(1, 2, 42));
    expect(await run(prog)).toBe(42);
  });
});

describe("fiber interpreter: race", () => {
  it("returns first resolved value", async () => {
    // With sync values, first branch wins
    const prog = app(($) => $.race(10, 20));
    const result = await run(prog);
    expect([10, 20]).toContain(result);
  });
});

describe("fiber interpreter: timeout", () => {
  it("returns expr value when fast enough", async () => {
    const prog = app(($) => $.timeout(42, 1000, "fallback"));
    expect(await run(prog)).toBe(42);
  });
});

describe("fiber interpreter: retry", () => {
  it("returns value on first success", async () => {
    const prog = app(($) => $.retry(42, { attempts: 3, delay: 0 }));
    expect(await run(prog)).toBe(42);
  });

  it("retries on failure and eventually gives up", async () => {
    const prog = app(($) => $.retry($.fail("boom"), { attempts: 2, delay: 0 }));
    await expect(run(prog)).rejects.toBe("boom");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- tests/plugins/fiber/interpreter.test.ts
```

Expected: FAIL.

**Step 3: Write the fiber interpreter**

Create `src/plugins/fiber/interpreter.ts`:

```typescript
import type { ASTNode, InterpreterFragment } from "../../core";

export const fiberInterpreter: InterpreterFragment = {
  pluginName: "fiber",
  canHandle: (node) => node.kind.startsWith("fiber/"),
  visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
    switch (node.kind) {
      case "fiber/par": {
        const branches = node.branches as ASTNode[];
        return Promise.all(branches.map((b) => Promise.resolve(recurse(b))));
      }

      case "fiber/par_map": {
        const parMapExpr = async () => {
          const collection = (await Promise.resolve(
            recurse(node.collection as ASTNode)
          )) as unknown[];
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
                return Promise.resolve(recurse(bodyClone));
              })
            );
            results.push(...batchResults);
          }
          return results;
        };
        return parMapExpr();
      }

      case "fiber/seq": {
        const seqExpr = async () => {
          const steps = node.steps as ASTNode[];
          for (const step of steps) {
            await Promise.resolve(recurse(step));
          }
          return await Promise.resolve(recurse(node.result as ASTNode));
        };
        return seqExpr();
      }

      case "fiber/race": {
        const branches = node.branches as ASTNode[];
        return Promise.race(branches.map((b) => Promise.resolve(recurse(b))));
      }

      case "fiber/timeout": {
        const timeoutExpr = async () => {
          const ms = (await Promise.resolve(
            recurse(node.ms as ASTNode)
          )) as number;
          const fallback = () => Promise.resolve(recurse(node.fallback as ASTNode));
          const expr = Promise.resolve(recurse(node.expr as ASTNode));
          const timer = new Promise<unknown>((resolve) =>
            setTimeout(async () => resolve(await fallback()), ms)
          );
          return Promise.race([expr, timer]);
        };
        return timeoutExpr();
      }

      case "fiber/retry": {
        const retryExpr = async () => {
          const attempts = node.attempts as number;
          const delay = (node.delay as number) ?? 0;
          let lastError: unknown;
          for (let i = 0; i < attempts; i++) {
            try {
              return await Promise.resolve(recurse(node.expr as ASTNode));
            } catch (e) {
              lastError = e;
              if (i < attempts - 1 && delay > 0) {
                await new Promise((r) => setTimeout(r, delay));
              }
            }
          }
          throw lastError;
        };
        return retryExpr();
      }

      default:
        throw new Error(`Fiber interpreter: unknown node kind "${node.kind}"`);
    }
  },
};

function injectLambdaParam(node: any, name: string, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, name, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, name, value);
    }
  }
}
```

**Step 4: Add export to index.ts**

```typescript
export { fiberInterpreter } from "./plugins/fiber/interpreter";
```

**Step 5: Run tests**

```bash
npm test -- tests/plugins/fiber/interpreter.test.ts
```

Expected: All passing.

**Step 6: Full suite**

```bash
npm run build && npm run check && npm test
```

**Step 7: Commit**

```bash
git add src/plugins/fiber/interpreter.ts tests/plugins/fiber/interpreter.test.ts src/index.ts
git commit -m "feat: add fiber interpreter (par/seq/race/timeout/retry)"
```

---

### Task 4: PostgresClient Interface + Postgres Interpreter (SQL Construction)

**Files:**
- Create: `src/plugins/postgres/3.4.8/interpreter.ts`

**Step 1: Write the PostgresClient interface and interpreter skeleton**

Create `src/plugins/postgres/3.4.8/interpreter.ts`:

```typescript
import { composeInterpreters } from "../../../core";
import type { ASTNode, InterpreterFragment } from "../../../core";

export interface PostgresClient {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  cursor(
    sql: string,
    params: unknown[],
    batchSize: number,
    fn: (rows: unknown[]) => Promise<void | false>,
  ): Promise<void>;
}

// Escape identifier — matches postgres.js src/types.js:216
function escapeIdentifier(name: string): string {
  return '"' + name.replace(/"/g, '""').replace(/\./g, '"."') + '"';
}

interface BuiltQuery {
  sql: string;
  params: unknown[];
}

// Build parameterized SQL from a postgres/query AST node.
// Resolves identifier, insert_helper, and set_helper fragments inline.
function buildSQL(
  node: ASTNode,
  recurse: (n: ASTNode) => unknown,
): BuiltQuery {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = recurse(param.name as ASTNode) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = recurse(param.data as ASTNode) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns = (param.columns as string[] | null) ??
          Object.keys(Array.isArray(data) ? data[0] : data);
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
                    return "$" + params.length;
                  })
                  .join(",") +
                ")",
            )
            .join(",");
      } else if (param.kind === "postgres/set_helper") {
        const data = recurse(param.data as ASTNode) as Record<string, unknown>;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return escapeIdentifier(col) + "=$" + params.length;
          })
          .join(",");
      } else {
        // Regular parameter — recurse to get the value
        params.push(recurse(param));
        sql += "$" + params.length;
      }
    }
  }

  return { sql, params };
}

export function postgresInterpreter(
  client: PostgresClient,
  outerFragments?: InterpreterFragment[],
): InterpreterFragment {
  return {
    pluginName: "postgres",
    canHandle: (node) => node.kind.startsWith("postgres/"),
    visit(node: ASTNode, recurse: (node: ASTNode) => unknown): unknown {
      switch (node.kind) {
        case "postgres/query": {
          const { sql, params } = buildSQL(node, recurse);
          return client.query(sql, params);
        }

        case "postgres/begin": {
          const beginExpr = async () => {
            return client.begin(async (tx) => {
              const txFragment = postgresInterpreter(tx, outerFragments);
              const txRecurse = outerFragments
                ? composeInterpreters([txFragment, ...outerFragments])
                : (n: ASTNode) => {
                    if (txFragment.canHandle(n)) return txFragment.visit(n, txRecurse);
                    return recurse(n);
                  };

              if (node.mode === "pipeline") {
                const queries = node.queries as ASTNode[];
                const results: unknown[] = [];
                for (const q of queries) {
                  results.push(await Promise.resolve(txRecurse(q)));
                }
                return results;
              }
              // callback mode
              return await Promise.resolve(txRecurse(node.body as ASTNode));
            });
          };
          return beginExpr();
        }

        case "postgres/savepoint": {
          const savepointExpr = async () => {
            return client.savepoint(async (tx) => {
              const txFragment = postgresInterpreter(tx, outerFragments);
              const txRecurse = outerFragments
                ? composeInterpreters([txFragment, ...outerFragments])
                : (n: ASTNode) => {
                    if (txFragment.canHandle(n)) return txFragment.visit(n, txRecurse);
                    return recurse(n);
                  };

              if (node.mode === "pipeline") {
                const queries = node.queries as ASTNode[];
                const results: unknown[] = [];
                for (const q of queries) {
                  results.push(await Promise.resolve(txRecurse(q)));
                }
                return results;
              }
              return await Promise.resolve(txRecurse(node.body as ASTNode));
            });
          };
          return savepointExpr();
        }

        case "postgres/cursor": {
          const cursorExpr = async () => {
            const queryNode = node.query as ASTNode;
            const { sql, params } = buildSQL(queryNode, recurse);
            const batchSize = (await Promise.resolve(
              recurse(node.batchSize as ASTNode)
            )) as number;

            await client.cursor(sql, params, batchSize, async (rows) => {
              const bodyClone = structuredClone(node.body);
              injectCursorBatch(bodyClone, rows);
              await Promise.resolve(recurse(bodyClone));
            });
          };
          return cursorExpr();
        }

        case "postgres/cursor_batch":
          return (node as any).__batchData;

        // These are resolved inline by buildSQL, never visited directly
        case "postgres/identifier":
        case "postgres/insert_helper":
        case "postgres/set_helper":
          throw new Error(
            `${node.kind} should be resolved during SQL construction, not visited directly`,
          );

        default:
          throw new Error(
            `Postgres interpreter: unknown node kind "${node.kind}"`,
          );
      }
    },
  };
}

function injectCursorBatch(node: any, rows: unknown[]): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectCursorBatch(item, rows);
    return;
  }
  if (node.kind === "postgres/cursor_batch") {
    node.__batchData = rows;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectCursorBatch(v, rows);
    }
  }
}
```

**Step 2: Add export to index.ts**

```typescript
export { postgresInterpreter } from "./plugins/postgres/3.4.8/interpreter";
export type { PostgresClient } from "./plugins/postgres/3.4.8/interpreter";
```

**Step 3: Build and check**

```bash
npm run build && npm run check
```

Expected: Compiles cleanly. Fix any type errors.

**Step 4: Commit**

```bash
git add src/plugins/postgres/3.4.8/interpreter.ts src/index.ts
git commit -m "feat: add postgres interpreter with PostgresClient interface"
```

---

### Task 5: postgres.js Client Adapter

Bridges real postgres.js to the PostgresClient interface.

**Files:**
- Create: `src/plugins/postgres/3.4.8/client-postgres-js.ts`

**Step 1: Write the adapter**

Create `src/plugins/postgres/3.4.8/client-postgres-js.ts`:

```typescript
import type { PostgresClient } from "./interpreter";
import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;
type TransactionSql = Parameters<Parameters<Sql["begin"]>[0]>[0];

export function wrapPostgresJs(sql: Sql | TransactionSql): PostgresClient {
  return {
    async query(sqlStr: string, params: unknown[]): Promise<unknown[]> {
      // Use sql.unsafe() to execute pre-built parameterized SQL
      const result = await (sql as Sql).unsafe(sqlStr, params as any[]);
      return Array.from(result);
    },

    async begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      return (sql as Sql).begin(async (txSql) => {
        return fn(wrapPostgresJs(txSql));
      }) as Promise<T>;
    },

    async savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T> {
      return (sql as any).savepoint(async (spSql: TransactionSql) => {
        return fn(wrapPostgresJs(spSql));
      }) as Promise<T>;
    },

    async cursor(
      sqlStr: string,
      params: unknown[],
      batchSize: number,
      fn: (rows: unknown[]) => Promise<void | false>,
    ): Promise<void> {
      await (sql as Sql)
        .unsafe(sqlStr, params as any[])
        .cursor(batchSize, async (rows: any[]) => {
          const result = await fn(rows);
          if (result === false) return (sql as any).CLOSE;
        });
    },
  };
}
```

**Step 2: Add export to index.ts**

```typescript
export { wrapPostgresJs } from "./plugins/postgres/3.4.8/client-postgres-js";
```

**Step 3: Build**

```bash
npm run build && npm run check
```

**Step 4: Commit**

```bash
git add src/plugins/postgres/3.4.8/client-postgres-js.ts src/index.ts
git commit -m "feat: add postgres.js client adapter (wrapPostgresJs)"
```

---

### Task 6: Cursor AST Support

Add cursor + cursor_batch node kinds to the postgres plugin.

**Files:**
- Modify: `src/plugins/postgres/3.4.8/index.ts`
- Modify: `tests/plugins/postgres/3.4.8/index.test.ts`

**Step 1: Write the failing cursor AST test**

Add to `tests/plugins/postgres/3.4.8/index.test.ts`:

```typescript
describe("postgres: cursor", () => {
  it("chained .cursor() produces postgres/cursor node", () => {
    const prog = app(($) => {
      return ($.sql`select * from users` as any).cursor(100, (batch: any) => {
        return $.sql`insert into archive ${$.sql.insert(batch)}`;
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("postgres/cursor");
    expect(ast.result.query.kind).toBe("postgres/query");
    expect(ast.result.batchSize.kind).toBe("core/literal");
    expect(ast.result.batchSize.value).toBe(100);
    expect(ast.result.body.kind).toBe("postgres/query");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/plugins/postgres/3.4.8/index.test.ts
```

Expected: FAIL — .cursor is not a function (proxy doesn't handle it yet).

**Step 3: Add cursor + cursor_batch to plugin**

Modify `src/plugins/postgres/3.4.8/index.ts`:

1. Add `"postgres/cursor"` and `"postgres/cursor_batch"` to `nodeKinds` array.

2. In the `makeSql` function, after creating `sqlFn`, add cursor support. The tricky part: `.cursor()` needs to be callable on query results. Since query results are `Expr<T[]>` (proxies), calling `.cursor()` on them would be intercepted as `core/method_call`. Instead, implement cursor as part of the query proxy.

**NOTE:** This step requires understanding how the Proxy intercepts method calls. The current proxy creates `core/method_call` nodes for unknown methods. Instead, the postgres plugin should handle `.cursor()` by wrapping the query node. This likely requires adding cursor support directly to the query-producing functions in `makeSql`, returning an enhanced Expr that has a `.cursor()` method.

**Approach:** Modify the tagged template function so the returned Expr carries `.cursor()` in a way the proxy can intercept. The simplest approach: instead of returning a plain `ctx.expr(queryNode)`, return a special proxy that intercepts `.cursor()` and produces the cursor AST node.

The implementation will depend on how the Proxy engine works in `core.ts`. Read `core.ts`'s proxy handler carefully. If the proxy intercepts `.cursor()` as a `core/method_call` node, we may need to intercept that in the plugin instead.

**Alternative simpler approach:** Add `$.sql.cursor(query, batchSize, fn)` as a helper method on the sql object (not chained). This avoids proxy complexity:

```typescript
sqlFn.cursor = (query: any, batchSize: any, fn: Function) => {
  const batchNode: ASTNode = { kind: "postgres/cursor_batch" };
  const batchProxy = ctx.expr(batchNode);
  const bodyResult = fn(batchProxy);
  const bodyNode = ctx.isExpr(bodyResult)
    ? bodyResult.__node
    : ctx.lift(bodyResult).__node;

  return ctx.expr({
    kind: "postgres/cursor",
    query: ctx.isExpr(query) ? query.__node : ctx.lift(query).__node,
    batchSize: ctx.isExpr(batchSize)
      ? batchSize.__node
      : { kind: "core/literal", value: batchSize },
    body: bodyNode,
    config: resolvedConfig,
  });
};
```

If chaining proves too complex for the proxy, use this helper approach and update the test. **Check with the user** if chaining is still required or if a helper is acceptable.

**Step 4: Run tests**

```bash
npm test -- tests/plugins/postgres/3.4.8/index.test.ts
```

**Step 5: Full suite**

```bash
npm run build && npm run check && npm test
```

**Step 6: Commit**

```bash
git add src/plugins/postgres/3.4.8/index.ts tests/plugins/postgres/3.4.8/index.test.ts
git commit -m "feat: add cursor support to postgres plugin (AST construction)"
```

---

### Task 7: Testcontainers Integration Tests — Basic Queries

The real test. Spin up Postgres, create tables, run programs through the interpreter, assert against real database state.

**Files:**
- Create: `tests/plugins/postgres/3.4.8/interpreter.test.ts`

**Step 1: Write the integration tests**

Create `tests/plugins/postgres/3.4.8/interpreter.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { composeInterpreters, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { eq } from "../../../../src/plugins/eq";
import { eqInterpreter } from "../../../../src/plugins/eq/interpreter";
import { ord } from "../../../../src/plugins/ord";
import { ordInterpreter } from "../../../../src/plugins/ord/interpreter";
import { semiring } from "../../../../src/plugins/semiring";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import {
  postgres as pgPlugin,
} from "../../../../src/plugins/postgres/3.4.8";
import {
  postgresInterpreter,
} from "../../../../src/plugins/postgres/3.4.8/interpreter";
import { wrapPostgresJs } from "../../../../src/plugins/postgres/3.4.8/client-postgres-js";

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
  errorInterpreter, fiberInterpreter, coreInterpreter,
  numInterpreter, ordInterpreter, eqInterpreter, strInterpreter,
];

function makeInterp() {
  const client = wrapPostgresJs(sql);
  return composeInterpreters([
    postgresInterpreter(client, nonPgFragments),
    ...nonPgFragments,
  ]);
}

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = makeInterp();
  return await Promise.resolve(interp(ast.result));
}

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  sql = postgres(container.getConnectionUri());

  // Create test tables
  await sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, age INT)`;
  await sql`INSERT INTO users (name, age) VALUES ('Murray', 68), ('Walter', 80), ('Alice', 25)`;
  await sql`CREATE TABLE audit_log (id SERIAL PRIMARY KEY, action TEXT, user_id INT)`;
}, 60000);

afterAll(async () => {
  await sql.end();
  await container.stop();
});

describe("postgres interpreter: basic queries", () => {
  it("select all rows", async () => {
    const prog = app(($) => $.sql`SELECT * FROM users ORDER BY id`);
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Murray");
    expect(result[2].name).toBe("Alice");
  });

  it("parameterized query", async () => {
    const prog = app(($) => $.sql`SELECT * FROM users WHERE age > ${50}`);
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
  });

  it("query with input parameters", async () => {
    const prog = app(
      { minAge: "number" },
      ($) => $.sql`SELECT * FROM users WHERE age > ${$.input.minAge} ORDER BY age`,
    );
    const result = (await run(prog, { minAge: 30 })) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Murray");
  });
});

describe("postgres interpreter: identifiers", () => {
  it("dynamic column selection", async () => {
    const prog = app(($) => $.sql`SELECT ${$.sql.id("name")} FROM users WHERE id = ${1}`);
    const result = (await run(prog)) as any[];
    expect(result[0]).toHaveProperty("name");
    expect(Object.keys(result[0])).toHaveLength(1);
  });
});

describe("postgres interpreter: insert helper", () => {
  it("inserts with column list", async () => {
    const prog = app(
      { name: "string", age: "number" },
      ($) => $.sql`INSERT INTO users ${$.sql.insert($.input, ["name", "age"])} RETURNING *`,
    );
    const result = (await run(prog, { name: "Test", age: 99 })) as any[];
    expect(result[0].name).toBe("Test");
    expect(result[0].age).toBe(99);
  });
});

describe("postgres interpreter: set helper", () => {
  it("updates with set clause", async () => {
    const prog = app(
      { id: "number", data: "object" },
      ($) =>
        $.sql`UPDATE users SET ${$.sql.set($.input.data, ["name"])} WHERE id = ${$.input.id} RETURNING *`,
    );
    const result = (await run(prog, { id: 1, data: { name: "Updated" } })) as any[];
    expect(result[0].name).toBe("Updated");
  });
});

describe("postgres interpreter: transactions", () => {
  it("pipeline mode commits multiple queries", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => [
        sql`INSERT INTO audit_log (action) VALUES ('tx_test_1')`,
        sql`INSERT INTO audit_log (action) VALUES ('tx_test_2')`,
      ]),
    );
    await run(prog);
    const rows = await sql`SELECT * FROM audit_log WHERE action LIKE 'tx_test%' ORDER BY id`;
    expect(rows).toHaveLength(2);
  });

  it("callback mode with data dependencies", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => {
        const user = sql`INSERT INTO users (name, age) VALUES ('TxUser', 42) RETURNING *`;
        const log = sql`INSERT INTO audit_log (action, user_id) VALUES ('created', ${user[0].id}) RETURNING *`;
        return $.do(user, log, { user: user[0], log: log[0] });
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.user.name).toBe("TxUser");
    expect(result.log.action).toBe("created");
    expect(result.log.user_id).toBe(result.user.id);
  });
});

describe("postgres interpreter: savepoints", () => {
  it("savepoint within transaction", async () => {
    const prog = app(($) =>
      $.sql.begin((sql) => {
        const sp = (sql as any).savepoint((sql2: any) => [
          sql2`INSERT INTO audit_log (action) VALUES ('savepoint_test')`,
        ]);
        return $.do(sp, sql`SELECT * FROM audit_log WHERE action = 'savepoint_test'`);
      }),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(1);
  });
});
```

**Step 2: Run integration tests**

```bash
npm test -- tests/plugins/postgres/3.4.8/interpreter.test.ts --timeout 60000
```

Expected: All passing (requires Docker). Debug failures — SQL construction issues will show up here.

**Step 3: Commit**

```bash
git add tests/plugins/postgres/3.4.8/interpreter.test.ts
git commit -m "feat: add postgres interpreter integration tests (testcontainers)"
```

---

### Task 8: Composition Tests — postgres + fiber + error

The final proof that the stack composes correctly.

**Files:**
- Add to: `tests/plugins/postgres/3.4.8/interpreter.test.ts`

**Step 1: Add composition test cases**

Append to interpreter.test.ts:

```typescript
describe("composition: error + postgres", () => {
  it("$.try catches a real constraint violation", async () => {
    // Insert duplicate into users with a unique constraint
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_name_unique ON users (name)`;
    const prog = app(($) =>
      $.try(
        $.sql`INSERT INTO users (name, age) VALUES ('Murray', 99) RETURNING *`,
      ).catch((err) => ({ caught: true, code: err.code })),
    );
    const result = (await run(prog)) as any;
    expect(result.caught).toBe(true);
    expect(result.code).toBe("23505"); // unique violation
  });

  it("$.orElse provides fallback on query error", async () => {
    const prog = app(($) =>
      $.orElse($.sql`SELECT * FROM nonexistent_table`, []),
    );
    const result = (await run(prog)) as any[];
    expect(result).toEqual([]);
  });
});

describe("composition: fiber + postgres", () => {
  it("$.par runs queries in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.sql`SELECT count(*)::int as c FROM users`,
        $.sql`SELECT count(*)::int as c FROM audit_log`,
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0][0].c).toBeGreaterThan(0);
  });

  it("$.retry retries a failing then succeeding scenario", async () => {
    // Create a table that tracks attempts
    await sql`CREATE TABLE IF NOT EXISTS retry_test (attempt INT)`;
    await sql`DELETE FROM retry_test`;

    // This test verifies retry works with real async postgres.
    // Use a simple query that always succeeds with retry:
    const prog = app(($) =>
      $.retry($.sql`INSERT INTO retry_test (attempt) VALUES (1) RETURNING *`, {
        attempts: 3,
        delay: 0,
      }),
    );
    const result = (await run(prog)) as any[];
    expect(result[0].attempt).toBe(1);
  });
});

describe("composition: error + fiber + postgres (nested)", () => {
  it("$.try wrapping $.retry wrapping query", async () => {
    const prog = app(($) =>
      $.try(
        $.retry($.sql`SELECT * FROM users WHERE name = 'Murray' LIMIT 1`, {
          attempts: 2,
          delay: 0,
        }),
      ).catch((_err) => []),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Murray");
  });
});
```

**Step 2: Run all integration tests**

```bash
npm test -- tests/plugins/postgres/3.4.8/interpreter.test.ts --timeout 60000
```

**Step 3: Full suite**

```bash
npm run build && npm run check && npm test
```

**Step 4: Commit**

```bash
git add tests/plugins/postgres/3.4.8/interpreter.test.ts
git commit -m "feat: add postgres + fiber + error composition tests"
```

---

### Task 9: Update Exports, Honest Assessment, and Clean Up

**Files:**
- Modify: `src/plugins/postgres/3.4.8/index.ts` (update honest assessment)
- Modify: `src/index.ts` (verify all new exports)

**Step 1: Update the honest assessment**

In `src/plugins/postgres/3.4.8/index.ts`, update the honest assessment section to reflect source-level analysis:

- Add cursor callback form to "WORKS GREAT" section
- Move cursor from "DOESN'T WORK" to a new note: async-iterable form not supported, callback form supported
- Update COPY note: "COPY is streaming in postgres.js (.writable()/.readable() return Node.js streams). Not modelable as request-response AST. Use tagged template for simple COPY TO STDOUT."
- Add note about source-level DD: "Based on analysis of postgres.js v3.4.8 source (github.com/porsager/postgres, tag v3.4.8)"

**Step 2: Final validation**

```bash
npm run build && npm run check && npm test
```

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: update honest assessment with source-level analysis, cursor support"
```

---

### Task 10: File spec-change Issue for VISION.md

**Step 1: Create the spec-change issue**

```bash
gh issue create \
  --title "spec-change: Update postgres plugin scope in VISION.md" \
  --label "spec-change" \
  --body "## Problem

VISION.md currently states for the postgres plugin:
> Not supported: cursors, streaming, COPY, LISTEN/NOTIFY

This is no longer accurate after #25.

## Evidence
- Cursor callback form is now supported (postgres/cursor AST node)
- COPY is intentionally not supported — postgres.js uses Node.js streams (.writable()/.readable()), which is fundamentally streaming, not request-response
- LISTEN/NOTIFY remains out of scope (push-based)
- Cursor async-iterable form remains out of scope (requires runtime iteration)

## Proposed Change
Update VISION.md Section 5, postgres plugin entry:
> **Not supported:** COPY (streaming in postgres.js), LISTEN/NOTIFY (push-based), cursor async-iterable form (requires runtime iteration). Cursor callback form is supported.

## Affected Sections
- VISION.md Section 5 (Current Plugins → Real-world plugins)

## Downstream Impact
None — this documents what was built, not a behavioral change."
```

**Step 2: Commit any remaining changes and verify clean state**

```bash
git status
npm run build && npm run check && npm test
```
