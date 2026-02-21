# Design: Port DAG Model to Core (#290)

## Summary

Replace core's nested TypedNode tree model with the koan-proven DAG adjacency map model. Koans 00-14 are imported verbatim as the immutable foundation. Core becomes a thin wrapper. `foldAST` is rewritten as `fold()` over NExpr adjacency maps with ST/error/fiber/lambda support.

## Key Design Decisions

1. **Builder produces DAG directly** — `mvfm()` internals construct content-addressed CExprs, normalize via `app()` (koan 03) to NExpr. No intermediate tree representation.
2. **No more Expr\<T\> proxy** — Users and plugins work with CExprs directly. No Proxy, no MVFM symbol, no auto-lift dance.
3. **Plugins still have build(ctx)** — but ctx is dramatically slimmed (just `plugins` list, maybe `lift`). build() returns functions that produce CExprs via content-addressed builders.
4. **mvfm() still wraps everything** — user closure returns a CExpr, mvfm() calls `app()` internally. User doesn't see `app()` directly.
5. **Full koan type precision** — koans are used verbatim, not simplified. If a core feature can't be expressed by koan primitives, we halt.
6. **Bias towards killing** — no backwards compatibility shims. If it doesn't serve the koan model or new fold, it dies.

## Section 1: Foundation Layer (Koans in Core)

Koans 00-14 copied into `packages/core/src/dag/` with numbers preserved:

```
spike-koans/00-expr.ts      → packages/core/src/dag/00-expr.ts
spike-koans/01-increment.ts → packages/core/src/dag/01-increment.ts
spike-koans/02-build.ts     → packages/core/src/dag/02-build.ts
spike-koans/03-normalize.ts → packages/core/src/dag/03-normalize.ts
spike-koans/04-predicates.ts → packages/core/src/dag/04-predicates.ts
spike-koans/05-select.ts    → packages/core/src/dag/05-select.ts
spike-koans/06-map.ts       → packages/core/src/dag/06-map.ts
spike-koans/07-replace.ts   → packages/core/src/dag/07-replace.ts
spike-koans/08-gc.ts        → packages/core/src/dag/08-gc.ts
spike-koans/09-dirty.ts     → packages/core/src/dag/09-dirty.ts
spike-koans/10-commit.ts    → packages/core/src/dag/10-commit.ts
spike-koans/11-wrap.ts      → packages/core/src/dag/11-wrap.ts
spike-koans/12-splice.ts    → packages/core/src/dag/12-splice.ts
spike-koans/13-named.ts     → packages/core/src/dag/13-named.ts
spike-koans/14-dagql.ts     → packages/core/src/dag/14-pipe.ts
```

Changes allowed:
- Adjust imports: switch from re-export chains to direct imports from earliest defining file
- Deduplicate: if something is defined in both koan 03 and koan 06, koan 06 imports from 03
- Add `export` where needed
- Keep all inline type-level and runtime tests (they lock the type algebra during build)

**Zero logic changes.** Barrel `packages/core/src/dag/index.ts` re-exports everything.

## Section 2: Builder Reshape

`mvfm()` becomes a thin wrapper:
1. Compose plugins via `build(ctx)` — plugins return CExpr builder functions
2. `PluginContext` slimmed to almost nothing: `{ plugins }` and maybe `lift()` for primitive→CExpr
3. User closure returns a CExpr
4. `mvfm()` internally calls `app()` (koan 03) to normalize into NExpr
5. `Program<K>` wraps NExpr (flat adjacency map) instead of nested AST

### What PluginContext had vs. what survives

| Field | Verdict |
|-------|---------|
| `expr<T>(node)` | **Deleted.** Proxy wrapping gone. Plugins use CExpr builders. |
| `lift(value)` | **Simplified.** Maybe survives as primitive→CExpr helper, or plugins just call `numLit()` directly. |
| `isExpr(value)` | **Deleted.** No runtime brand checking. CExprs are structurally typed with phantom brands. |
| `emit(node)` | **Deleted.** Side effects handled by `core/discard` node (see below). |
| `statements` | **Deleted.** No statement list. |
| `_registry` | **Deleted.** Koan 08 GC handles reachability. |
| `plugins` | **Survives.** Needed for interpreter lookup. |
| `inputSchema` | **Survives if needed.** Orthogonal to DAG vs tree. |

### CoreDollar becomes CExpr builders

- `cond(pred, then, else)` → CExpr with kind `core/cond`, 3 positional children
- `begin(x, y, z)` → desugars to chain of `core/discard` CExprs: `discard(z, discard(y, x))`. `core/discard` evaluates child 0 for side effect, returns child 1. Like Haskell's `const` but without the name collision.
- `rec(fn)` → CExpr with kind `core/rec`
- `input` → CExpr with kind `core/input`

### Deleted machinery

- `proxy.ts` — entire file (Expr<T>, makeExprProxy, autoLift, isExpr, MVFM symbol)
- `utils.ts` — nextNodeId(), simpleHash, isInternalNode
- Reachability analysis in builder.ts
- The lift→unwrap→construct→wrap dance in every plugin

## Section 3: The New fold() (replacing foldAST)

Koan 15's `fold()` is the sketch. Production version adds four capabilities.

### 3a. Base trampoline (from koan 15)
- Explicit stack of frames: `{ gen, entryId, childIds }`
- `gen.next(input)` yields a child index → push child frame
- When frame completes → cache result, pop, feed result to parent
- Memoization: shared DAG nodes evaluate once

### 3b. ST (mutable state)
- `VOLATILE_KINDS` set (e.g., `st/get`) — skip memo cache
- Volatile re-evaluation may produce different results → taint all ancestors
- `tainted: Set<string>` tracks tainted entry IDs
- Tainted nodes also skip memo on next access
- Store is `Map<string, unknown>` in interpreter closure

### 3c. Error (try/catch/fail)
- `error/fail` handler throws
- `error/try` wraps child evaluation — catches and evaluates fallback child
- `gen.throw(pendingError)` propagates errors up frame stack until caught

### 3d. Fiber (parallelism)
- `fiber/spawn` calls `fold()` recursively with its own trampoline+memo
- Shares the NExpr (read-only adjacency map, safe to share)
- Independent evaluation state per fiber
- Results collected via `await`

### 3e. Scoped lambdas
- Yield type: `number | { child: number, scope: bindings }`
- `scopeStack: Array<Map<string, unknown>>` in trampoline state
- `core/lambda_param` is volatile — reads from top of scope stack
- Lambda invocation yields `{ child: bodyIndex, scope: { paramName: argValue } }`
- Taint propagation ensures re-evaluation with different arguments

### Handler signature
```ts
// Old: named field access
"num/add": async function* (node: NumAddNode) {
  return (yield* eval_(node.left)) + (yield* eval_(node.right));
}

// New: positional children
"num/add": async function* (_entry) {
  return ((yield 0) as number) + ((yield 1) as number);
}
```

### Halt conditions for fold
- Memoization must be correct: every interpreter is assumed effectful, memoize always unless volatile/tainted
- If taint semantics don't compose (something memoizes when it shouldn't, or re-evaluates when it shouldn't) → halt
- If an interpreter pattern can't be expressed with positional children + async generator yields → halt

## Section 4: Core Interpreter Migration

Core interpreters rewritten as positional handlers (in scope for this ticket):

- `core/cond` — `yield 0` for predicate, conditionally `yield 1` or `yield 2` (short-circuit preserved)
- `core/discard` — `yield 0` (side effect, discard result), `yield 1` (return value)
- `core/literal` — no children, return value from entry's `out` field
- `core/rec` — recursive evaluation via scoped yields
- `core/lambda` / `core/lambda_param` — scoped lambda mechanism
- `core/input` — resolve from program inputs
- `core/prop_access` — `yield 0`, access property on result

Plugin interpreters (num, str, boolean, etc.) are the same mechanical transform but scoped to #291.

## Section 5: Test Migration

**Rewritten (semantics preserved, syntax changes):**
- Core interpreter behavior — cond short-circuits, begin sequences, rec terminates, literals resolve
- Memoization/DAG — shared nodes evaluate once (should get simpler)
- Lambda/scope — lambda params resolve from scope stack
- Defaults/interpreter composition
- ST, error, fiber features

**Deleted (testing removed machinery):**
- Proxy behavior tests
- Reachability analysis tests
- isExpr, autoLift, makeExprProxy tests
- Anything testing Expr<T>/ExprFields<T>

**New:**
- Inline koan runtime tests (stay in koan files)
- Integration tests for fold() with ST/error/fiber/lambda

## Section 6: What Gets Killed

### Files deleted entirely
- `proxy.ts`
- `utils.ts` (or gutted to nothing)

### Files gutted and rewritten
- `builder.ts` — thin wrapper around koan primitives
- `fold.ts` — entirely new fold() over NExpr
- `types.ts` — Expr<T>/ExprBase/ExprFields/MVFM deleted, Program<K> internals changed, PluginContext slimmed

### Concepts that disappear
- Numeric `__id` on nodes
- `_registry` Map
- Reachability walk over nested object tree
- `__node` unwrapping
- Statement list / `emit()`
- `TypedNode` base interface
- Named field access in handlers

No backwards compatibility shims. No re-exports of removed types. No `_deprecated` prefixes. Kill clean.

## Section 7: Migration Order

1. **Koans into core** — copy 00-14, adjust imports, verify compile
2. **New fold()** — write over NExpr with ST/error/fiber/lambda. Hardest piece, most likely to surface halts.
3. **Gut builder** — slash mvfm() to thin wrapper, delete proxy/registry/reachability, wire CExpr builders + app()
4. **Rewrite core interpreters** — positional handlers for core/* nodes
5. **Rewrite plugin interpreters** — mechanical positional transform (may overlap with #291)
6. **Rewrite tests** — new API, same semantics
7. **Delete dead code** — final sweep

## Halt Protocol

If any of these arise, **stop and report on #290** rather than forcing a workaround:
- A core feature requires changing any koan 00-14 type or function
- An interpreter pattern can't be expressed with positional children + async generator yields
- Memoization/taint semantics don't compose correctly
- An existing test's semantics can't be preserved

Report includes: what failed, which koan primitive is insufficient, what the core feature needs. Don't force it, don't create workarounds, don't modify koans.
