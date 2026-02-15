# Step Evaluator and Client Interpreter Design

**Issue**: #38
**Date**: 2026-02-13
**Status**: Design

## Problem

Mvfm programs are portable ASTs, but interpretation is monolithic. The current `composeInterpreters` is a fold (`foldFree` equivalent) — it consumes the entire AST eagerly with no visibility into intermediate steps. This makes it impossible to:

1. Build a browser-side interpreter that proxies effects over HTTP to a server
2. Verify execution in a 0-trust environment (server replays browser's steps to confirm correctness)
3. Thread user-defined state through the traversal
4. Implement custom traversal strategies (partial evaluation, static analysis, step debugging)

The browser interpreter use case (issue #38) revealed that the interpreter architecture needs richer primitives before a proper client interpreter can exist.

## Insight: PureScript's Free Monad Hierarchy

PureScript offers a hierarchy of interpretation primitives for free monads:

| Primitive | Expressiveness | Mvfm equivalent |
|-----------|---------------|----------------|
| `foldFree` | Least — natural transformation, no step visibility | Current `composeInterpreters` |
| `runFreeM` | Middle — step-by-step with monadic effect handling | `runAST` (new) |
| `resume` / `resume'` | Most — peel one layer, full control | `Stepper.tick` (new) |

Each level is built on the one below. `foldFree` is implemented via `runFreeM`, which is implemented via `resume`. The step primitive is the foundation; the fold is a convenience.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | Raw SQL over HTTP | PostgREST is resource-oriented, doesn't support raw SQL. Raw SQL preserves full `PostgresClient` contract. |
| Approach | Step-based primitives (PureScript-style `resume`) | Most expressive. Effect-based handlers (approach C) are a pattern built on top, not a separate primitive. |
| Step shape | Node + effect + context + user-threaded state + continuation | User needs to accumulate proof/state during traversal. |
| Layering | Step is the primitive; `composeInterpreters` is built on top | Single code path. Current behavior preserved as Level 2 convenience. |
| Trampoline | Explicit stack on heap, while loop | Stack-safe regardless of AST depth. Generators are heap-allocated. |
| Client vs server | Handler-level distinction, not fragment-level | Same `InterpreterFragment` (generator) on both sides. Only the effect handler differs. |
| Testing | Real Postgres (testcontainers) + real HTTP (`node:http`) | No mocks. Verifiable execution requires verifiable tests. |
| Migration | Spike then graduate all interpreters in the same effort | No lingering legacy code. If spike succeeds, finish it. |

## Architecture

### The Step Primitive

The core type is `Step<S>` — what you get when you peel one layer from an AST node:

```typescript
type Step<S> =
  | { done: true; value: unknown; state: S }
  | { done: false;
      node: ASTNode;           // the node being interpreted
      effect: StepEffect;      // what it wants to do
      context: StepContext;    // where we are in the traversal
      state: S;                // user-threaded accumulator
    };

type StepEffect =
  | { type: 'recurse'; child: ASTNode }
  | { type: 'query'; sql: string; params: unknown[] }
  | { type: 'begin'; mode: 'pipeline' | 'callback'; body?: ASTNode; queries?: ASTNode[] }
  | { type: 'savepoint'; mode: 'pipeline' | 'callback'; body?: ASTNode; queries?: ASTNode[] }
  | { type: 'cursor'; sql: string; params: unknown[]; batchSize: number; body: ASTNode }
  // Plugins extend this — each plugin declares its own effect types

interface StepContext {
  depth: number;
  path: string[];        // node kinds traversed to get here
  parentNode?: ASTNode;
}
```

`StepEffect` is an open discriminated union. Each plugin adds its own effect types. The `recurse` effect is structural traversal — the stepper can handle it automatically or the caller can intercept.

### InterpreterFragment Becomes a Generator

The current `visit` is imperative — it calls `recurse` and does IO inline:

```typescript
// Current
visit: (node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>;
```

The new `visit` is a sync generator that yields effects and receives results:

```typescript
// New
visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
```

Sync, not async — `visit` never does IO itself. All IO goes through yielded effects. The trampoline loop handles the async.

Example — postgres query:

```typescript
*visit(node: ASTNode) {
  switch (node.kind) {
    case "postgres/query": {
      const { sql, params } = yield* buildSQL(node);
      return yield { type: 'query', sql, params };
    }
    case "postgres/begin": {
      return yield { type: 'begin', mode: node.mode, body: node.body, queries: node.queries };
    }
    case "postgres/cursor": {
      const { sql, params } = yield* buildSQL(node.query as ASTNode);
      const batchSize = yield { type: 'recurse', child: node.batchSize };
      return yield { type: 'cursor', sql, params, batchSize, body: node.body };
    }
  }
}
```

Helper functions become generators too:

```typescript
function* buildSQL(node: ASTNode): Generator<StepEffect, BuiltQuery, unknown> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = yield { type: 'recurse', child: param.name };
        sql += escapeIdentifier(name as string);
      } else if (param.kind === "postgres/insert_helper") {
        const data = yield { type: 'recurse', child: param.data };
        // ... build insert SQL from data
      } else {
        const value = yield { type: 'recurse', child: param };
        params.push(value);
        sql += `$${params.length}`;
      }
    }
  }
  return { sql, params };
}
```

Each `yield` is a suspension point. Control returns to the trampoline loop. Generator frames live on the heap, not the stack.

### The Trampoline and Three Levels

The `Stepper` class manages a stack of generator frames on the heap. Each `.tick()` advances one step.

```typescript
class Stepper<S> {
  private stack: { gen: Generator<StepEffect, unknown, unknown>; node: ASTNode }[];
  private cache: WeakMap<ASTNode, unknown>;
  private tainted: WeakSet<ASTNode>;
  private fragments: InterpreterFragment[];

  constructor(root: ASTNode, fragments: InterpreterFragment[]);

  // Advance one tick. Returns the next effect to handle, or done.
  tick(lastResult?: unknown): Step<S>;

  // Push a child generator onto the stack (for recurse effects)
  descend(child: ASTNode): void;
}
```

Internal tick loop:

1. Feed `lastResult` into the current generator via `.next(lastResult)`
2. Generator **yields an effect** → return it as a `Step` to the caller
3. Generator **is done** → pop stack, cache result, feed return value to parent, repeat
4. **Stack empty** and last generator done → return `{ done: true, value }`

#### Level 0: Full control

The caller drives the stepper manually. Sees every effect including `recurse`. Can intercept, skip, or provide cached values.

```typescript
const stepper = new Stepper(root, fragments);
let result: unknown;

while (true) {
  const step = stepper.tick(result);
  if (step.done) break;

  if (step.effect.type === 'recurse') {
    stepper.descend(step.effect.child);  // or: result = cachedValue (skip recursion)
    continue;
  }

  result = await executeOrVerifyOrMock(step.effect);
}
```

#### Level 1: Handler-driven loop

Auto-handles recursion with caching. IO effects go to a handler with user-threaded state.

```typescript
type StepHandler<S> = (
  effect: StepEffect,
  context: StepContext,
  state: S,
) => Promise<{ value: unknown; state: S }>;

async function runAST<S>(
  root: ASTNode,
  fragments: InterpreterFragment[],
  handler: StepHandler<S>,
  initialState: S,
): Promise<{ value: unknown; state: S }>;
```

#### Level 2: Convenience fold

What `composeInterpreters` becomes. API-compatible with the current `RecurseFn`.

```typescript
function foldAST(
  fragments: InterpreterFragment[],
  handlers: Record<string, (effect: StepEffect) => Promise<unknown>>,
): RecurseFn;
```

### Caching and Volatility

Caching moves from `composeInterpreters` into the `Stepper`. It's a concern of the trampoline, not the interpreter fragments.

- **On descend**: check cache. If hit and not tainted, provide value without pushing a generator.
- **On pop**: cache the result. If volatile or has tainted children, mark tainted and evict.
- **No more `Promise<unknown>` in cache**: trampoline is sequential, so we cache plain values.
- **Volatility is declarable per-plugin**:

```typescript
interface InterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
  isVolatile?: (node: ASTNode) => boolean;  // optional, defaults to false
}
```

`fresh()` (used by retry logic) creates a new `Stepper` with an empty cache.

### Client vs Server: Handler-Level Distinction

The interpreter fragment is shared. Only the effect handler differs.

```
                    ┌─────────────────────┐
                    │  postgresInterpreter │   shared generator
                    │  (visit generators)  │
                    └────────┬────────────┘
                             │ yields effects
                    ┌────────┴────────┐
                    │                 │
           ┌───────▼──────┐  ┌───────▼───────┐
           │ serverHandler │  │ clientHandler  │
           │ calls DB      │  │ sends over HTTP│
           └──────────────┘  └───────────────┘
```

#### Server handler

Wraps a `PostgresClient`. Same behavior as today's interpreter.

```typescript
function serverHandler(
  client: PostgresClient,
  fragments: InterpreterFragment[],
): StepHandler<void> {
  return async (effect, context, state) => {
    switch (effect.type) {
      case 'query':
        return { value: await client.query(effect.sql, effect.params), state };
      case 'begin':
        return {
          value: await client.begin(async (tx) => {
            const { value } = await runAST(effect.body, fragments, serverHandler(tx, fragments), undefined);
            return value;
          }),
          state,
        };
      case 'savepoint': /* same pattern with client.savepoint */
      case 'cursor': /* client.cursor with sub-stepper per batch */
    }
  };
}
```

#### Client handler

Sends effects over HTTP with contract metadata for 0-trust verification.

```typescript
function clientHandler(options: {
  baseUrl: string;
  contractHash: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
}): StepHandler<{ stepIndex: number }> {
  return async (effect, context, state) => {
    const headers = typeof options.headers === 'function'
      ? await options.headers()
      : options.headers ?? {};

    const res = await (options.fetch ?? globalThis.fetch)(
      `${options.baseUrl}/mvfm/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          contractHash: options.contractHash,
          step: state.stepIndex,
          effect,
          path: context.path,
        }),
      },
    );

    if (!res.ok) throw new Error(`mvfm proxy: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { value: data.result, state: { stepIndex: state.stepIndex + 1 } };
  };
}
```

#### Proxy hooks are handler composition

No separate `ProxyHook` interface. Users compose handlers:

```typescript
const myHandler: StepHandler<MyState> = async (effect, context, state) => {
  // Auth
  state.headers = { Authorization: `Bearer ${state.token}` };
  // Cache check
  if (effect.type === 'query' && myCache.has(effect.sql)) {
    return { value: myCache.get(effect.sql), state };
  }
  // Delegate
  return baseClientHandler(effect, context, state);
};
```

### 0-Trust Verification Model

The browser sends `{ contractHash, step, effect, path }` with each request. The server:

1. Looks up the program by `contractHash`
2. Replays its own stepper to step N
3. Verifies the effect matches what the contract produces given previous IO results
4. Executes the effect
5. Returns the result

The server is the IO gate. It knows all inputs and outputs. A malicious browser can't forge steps because the server independently derives what each step should be.

## File Changes

```
src/
  core.ts                                    # Add Step types, Stepper, runAST, foldAST
                                             # composeInterpreters becomes wrapper over foldAST
                                             # InterpreterFragment gets generator visit

  plugins/postgres/3.4.8/
    interpreter.ts                           # Refactor visit to generator, extract effects
    handler.server.ts                        # NEW: server effect handler
    handler.client.ts                        # NEW: client effect handler
    index.ts                                 # Unchanged
    client-postgres-js.ts                    # Unchanged

  interpreters/
    core.ts                                  # Refactor to generator

  index.ts                                   # Add new exports
```

### New exports

```typescript
// Step primitives
export { Stepper, runAST, foldAST } from "./core";
export type { Step, StepEffect, StepContext, StepHandler } from "./core";

// Postgres handlers
export { serverHandler } from "./plugins/postgres/3.4.8/handler.server";
export { clientHandler } from "./plugins/postgres/3.4.8/handler.client";
```

## Test Strategy

No mocks. Verifiable execution requires verifiable tests.

1. **Existing postgres tests pass** — `composeInterpreters` with refactored generator-based interpreter, backward compatible
2. **Step-level tests against real DB** — `Stepper` against testcontainers Postgres, verify each effect produces correct results
3. **Full round-trip integration test**:
   - Start Postgres container (testcontainers)
   - Start `node:http` server wrapping `serverHandler`
   - Run same program two ways:
     - Direct: `foldAST` + `serverHandler` against DB
     - Proxied: `foldAST` + `clientHandler` → HTTP → server → DB
   - Assert both produce identical results
4. **0-trust verification test** — server replays client's execution trace, verifies each step's effect matches what the contract produces

## Migration: Spike to Ship

The spike uses a `LegacyInterpreterFragment` adapter so non-postgres interpreters don't need to change immediately. After the integration tests pass (go/no-go checkpoint), graduate all interpreters in the same effort.

The migration is mechanical for each interpreter:

```typescript
// Before
async visit(node, recurse) {
  case "num/add":
    return (await recurse(node.left)) + (await recurse(node.right));
}

// After
*visit(node) {
  case "num/add": {
    const left = yield { type: 'recurse', child: node.left };
    const right = yield { type: 'recurse', child: node.right };
    return (left as number) + (right as number);
  }
}
```

Migration order:

1. `core` interpreter (done in spike)
2. `num`, `str`, `boolean` — trivial pure operations
3. `eq`, `ord`, `show`, `semigroup`, `monoid`, `bounded`, `heytingAlgebra` — typeclass interpreters
4. `st` — state plugin
5. `error` — lambda injection, needs care
6. `fiber` — concurrency primitives, most complex

After all interpreters are migrated:

- Delete `LegacyInterpreterFragment` and `adaptLegacy`
- Delete `__legacy` effect handling from `Stepper`
- `composeInterpreters` becomes a one-liner over `foldAST`
- All tests updated to new API
- Zero legacy code ships
