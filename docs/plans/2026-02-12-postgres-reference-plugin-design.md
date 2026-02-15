# Postgres Reference Plugin Design

**Date:** 2026-02-12
**Status:** Design approved, pending implementation
**Issue:** #25
**Depends on:** #24 (directory restructure — complete), #28 (broader typeclass hierarchy — complete)

## Problem

The postgres plugin exists as an AST producer but has no interpreter, no tests for interpretation, and no validation that it composes correctly with fiber and error. This is the first real-world plugin that 100+ agents will study. It must demonstrate the complete lifecycle: AST construction, interpreter, composition with the effect stack, and real-database tests.

## Key Design Insight: Promise IS Aff

PureScript's `Aff` is the async effect monad with built-in error handling (`MonadThrow`, `MonadError`) and parallelism (`Parallel`). JavaScript's `Promise` is isomorphic to `Aff` — as proven by [purescript-js-promise-aff](https://github.com/purescript-contrib/purescript-js-promise-aff):

```purescript
fromAff :: Aff a -> Effect (Promise b)  -- Aff → Promise
toAff :: Promise a -> Aff a              -- Promise → Aff
```

This means mvfm does NOT need an explicit monad stack. JavaScript's native `Promise` already provides:
- **MonadThrow**: `throw` / `Promise.reject`
- **MonadError**: `try/catch` / `.catch()`
- **Parallel**: `Promise.all`, `Promise.race`, `Promise.allSettled`
- **Sequencing**: `await` (bind)

The interpreter's job is to map AST nodes to Promise operations. Composition works because Promise composition works.

### The mapping

| AST node | Promise operation | PureScript equivalent |
|---|---|---|
| `error/try` + catch | `try { await x } catch (e) { ... }` | `catchError` |
| `error/fail` | `throw e` | `throwError` |
| `error/attempt` | `try { {ok, err:null} } catch { {ok:null, err} }` | `attempt` / `try` |
| `error/guard` | `if (!cond) throw e` | `when (not cond) (throwError e)` |
| `error/settle` | `Promise.allSettled(xs)` | `traverse attempt` |
| `fiber/par` | `Promise.all(xs)` | `parSequence` |
| `fiber/race` | `Promise.race(xs)` | `sequential (alt ...)` |
| `fiber/timeout` | `Promise.race([x, delay.then(fallback)])` | `sequential (parallel x <\|> parallel (delay *> pure fallback))` |
| `fiber/retry` | loop with try/catch + delay | `tailRecM` with `catchError` + `delay` |
| `fiber/seq` | sequential await | `bind` chain |
| `postgres/query` | `client.query(sql, params)` | FFI / `liftAff` |

## Scope

### In scope

**Postgres operations** (8 node kinds):
- `postgres/query` — tagged template queries (exists)
- `postgres/identifier` — dynamic column/table names (exists)
- `postgres/insert_helper` — dynamic INSERT clauses (exists)
- `postgres/set_helper` — dynamic UPDATE SET clauses (exists)
- `postgres/begin` — transactions, pipeline + callback modes (exists)
- `postgres/savepoint` — savepoints within transactions (exists)
- `postgres/cursor` — cursor callback form (NEW)
- `postgres/cursor_batch` — placeholder for current batch in cursor body (NEW)

**Interpreters** (3 new interpreter files):
- `postgresInterpreter(client)` — factory taking `PostgresClient` interface
- `fiberInterpreter` — maps fiber nodes to Promise operations
- `errorInterpreter` — maps error nodes to try/catch/throw

**Tests:**
- AST construction tests for cursor (extends existing index.test.ts)
- Interpreter integration tests using testcontainers (real Postgres)
- Composition tests: postgres + fiber + error together

### Not in scope

- COPY (`writable()`/`readable()` in postgres.js are Node.js streams — fundamentally streaming, not request-response)
- Cursor async-iterable form (requires runtime iteration, can't be expressed as finite AST)
- `unsafe`, `describe`, `values`, `raw`, `simple`, `forEach`, `json`, `array`, `typed`, `file`
- LISTEN/NOTIFY (push-based, server-initiated)
- Connection lifecycle (`end`, `close`, `reserve`)

### Source-level DD

The design is based on studying the actual postgres.js v3.4.8 source code (cloned from GitHub), NOT from memory or documentation alone. Key files examined:
- `src/index.js` — main entry, `Sql` function, `begin`, `reserve`
- `src/query.js` — `Query` class, `.cursor()`, `.readable()`, `.writable()`, `.forEach()`
- `src/types.js` — `Identifier`, `Builder`, `handleValue`, `stringify`
- `types/index.d.ts` — full TypeScript type definitions
- `README.md` — cursor, COPY, and other API documentation

**This practice (clone upstream, read source, base design on actual code) must be followed for every real-world plugin.** See comment on #26.

## Cursor Design

### DSL usage

```ts
// Callback form — matches postgres.js: sql`...`.cursor(batchSize, fn)
$.sql`select * from large_table`.cursor(100, (batch) => {
  return $.sql`insert into archive ${$.sql.insert(batch)}`
})
```

### AST node

```ts
{
  kind: "postgres/cursor",
  query: { kind: "postgres/query", ... },
  batchSize: { kind: "core/literal", value: 100 },
  body: ASTNode,  // result of calling fn with cursor_batch placeholder
  config: resolvedConfig
}
```

### Implementation

The `.cursor()` method is intercepted via proxy on query `Expr` results. The callback receives a fresh `Expr<Row[]>` backed by a `postgres/cursor_batch` marker node. The callback runs synchronously during AST build, producing the body node.

The interpreter:
1. Builds SQL from the query node (same as `postgres/query`)
2. Calls `client.cursor(sql, params, batchSize, async rows => { ... })`
3. For each batch, injects the rows at the `cursor_batch` node and evaluates the body

## PostgresClient Interface

```ts
export interface PostgresClient {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  cursor(
    sql: string,
    params: unknown[],
    batchSize: number,
    fn: (rows: unknown[]) => Promise<void | false>
  ): Promise<void>;
}
```

Design decisions:
- **Identifier/insert/set resolution happens in the interpreter**, not the client. The client only sees final SQL + params.
- **`savepoint` is a separate method** because postgres.js savepoints have different semantics than transactions (auto-named, nested within tx).
- **Cursor callback returns `void | false`** — `false` maps to postgres.js's `sql.CLOSE` early-termination pattern.

## Interpreter: SQL Construction

The interpreter resolves fragment nodes (identifier, insert_helper, set_helper) into the SQL string during query construction. This is based on how postgres.js's `stringify` function works in `src/types.js`.

```
postgres/query { strings: ["select ", " from users"], params: [postgres/identifier { name: "age" }] }
→ SQL: 'select "age" from users', params: []

postgres/query { strings: ["insert into users ", ""], params: [postgres/insert_helper { data: {...}, columns: ["name", "age"] }] }
→ SQL: 'insert into users ("name","age") values ($1,$2)', params: ["Murray", 68]
```

Identifier escaping follows postgres.js exactly: `'"' + name.replace(/"/g, '""').replace(/\./g, '"."') + '"'` (from `src/types.js:216`).

## Interpreter: Async Model

The current `InterpreterFragment.visit` returns `unknown`. For async operations, it returns `Promise<unknown>`. The `composeInterpreters` function doesn't need to change — `recurse` returns `unknown` which may be a Promise.

Async interpreters use `await Promise.resolve(recurse(node))` to handle both sync and async sub-expressions. This pattern:
- If `recurse` returns a sync value: `Promise.resolve(value)` wraps it, `await` unwraps it — no-op
- If `recurse` returns a Promise: `Promise.resolve(promise)` passes through, `await` unwraps it

Sync interpreters (num, str, boolean) are unaffected.

## Interpreter: Transaction Scoping

When interpreting `postgres/begin`, the interpreter creates a scoped interpreter for the transaction:

```ts
case "postgres/begin": {
  return client.begin(async (tx) => {
    // Create a new postgres interpreter scoped to the tx client
    // Compose it with the outer non-postgres fragments
    const txInterp = composeInterpreters([
      errorInterpreter, fiberInterpreter,
      postgresInterpreter(tx),  // tx-scoped
      coreInterpreter
    ]);
    // Interpret body/queries with the tx interpreter
    ...
  });
}
```

This ensures queries inside a transaction use the transaction connection, while non-postgres nodes (error, fiber, core) use the same interpreters.

## Trait Participation

None. Postgres is an external service plugin, not a data type. Query results are dynamic `Record<string, any>[]`. This is the correct pattern for service plugins — the agent swarm needs to see that not every plugin declares traits.

## Error and Fiber: Not Typeclasses

Error stays as a standalone plugin (not a typeclass). Rationale:
- JavaScript has exactly one error mechanism (throw/catch/Promise rejection)
- No polymorphism to capture — there's only one execution context
- The standalone model composes correctly via JavaScript's native error propagation
- Adding typeclass machinery increases complexity without benefit

Fiber stays as a standalone plugin. It maps to Promise combinators. No monad transformer needed.

Both were validated by studying PureScript's Aff (`purescript-aff`) and the Promise↔Aff isomorphism (`purescript-js-promise-aff`). PureScript needs explicit `MonadThrow`/`MonadError` because it has multiple monads with different error semantics. JavaScript has one. We don't need the abstraction.

## Testing Strategy

**AST tests** (`tests/plugins/postgres/3.4.8/index.test.ts`):
- Fast, no Docker
- Verify AST node shapes for all 8 operations including cursor
- Existing tests cover queries, identifiers, insert/set, transactions, savepoints, $.do integration

**Interpreter tests** (`tests/plugins/postgres/3.4.8/interpreter.test.ts`):
- Testcontainers: real PostgreSQL in Docker
- Real postgres.js client via `client-postgres-js.ts` adapter
- Tests skip if Docker unavailable
- Cover every operation against real database

**Composition tests** (in interpreter.test.ts):
- `error/try` wrapping `postgres/query` — catch a real constraint violation
- `fiber/retry` wrapping `postgres/query` — retry a genuinely failing query
- `fiber/par` with multiple `postgres/query` — parallel real queries
- `fiber/timeout` wrapping `postgres/query` — timeout a slow query
- `error/settle` with multiple `postgres/query` — collect successes and failures
- Nested: `error/try` → `fiber/retry` → `postgres/query`

## File Layout

```
src/plugins/postgres/3.4.8/
  index.ts              # Plugin definition (modify: add cursor + cursor_batch)
  interpreter.ts        # NEW: postgresInterpreter factory + PostgresClient interface
  client-postgres-js.ts # NEW: wrapPostgresJs adapter

src/plugins/fiber/
  interpreter.ts        # NEW: fiberInterpreter

src/plugins/error/
  interpreter.ts        # NEW: errorInterpreter

tests/plugins/postgres/3.4.8/
  index.test.ts         # AST tests (modify: add cursor tests)
  interpreter.test.ts   # NEW: testcontainers integration tests

tests/plugins/fiber/
  interpreter.test.ts   # NEW: fiber interpreter tests (compose with postgres)

tests/plugins/error/
  interpreter.test.ts   # NEW: error interpreter tests (compose with postgres)
```

## New Dependencies (dev)

- `postgres` — the actual postgres.js library (for adapter and tests)
- `@testcontainers/postgresql` — real Postgres in Docker for tests

## Spec-Change Issue

File a `spec-change` issue to update VISION.md's postgres entry:
- **Old:** "Not supported: cursors, streaming, COPY, LISTEN/NOTIFY"
- **New:** "Not supported: COPY (streaming in postgres.js), LISTEN/NOTIFY (push-based), cursor async-iterable (requires runtime iteration). Cursor callback form is supported."

## Risks

- **Async interpreter composition is untested.** This is the first time sync and async interpreters compose. The `await Promise.resolve(recurse(...))` pattern should work but needs validation.
- **Transaction scoping creates new interpreter instances.** This is correct but adds complexity. The testcontainers tests must cover nested transactions with savepoints.
- **Testcontainers requires Docker.** CI must have Docker available. Tests skip gracefully otherwise.
- **Cursor proxy interception.** The `.cursor()` method on query results requires the proxy to intercept method calls on Expr values. This should work (the proxy already intercepts property access) but needs verification.
