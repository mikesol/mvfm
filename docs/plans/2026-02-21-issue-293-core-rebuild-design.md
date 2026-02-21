# Issue #293: Core Rebuild Design

## Strategy

Replace-from-scratch with a test fortress built upfront. Two invariant layers validate the rebuild:

1. **Frozen koans** (20 files, ~273 assertions): copied from `spike-koans-baseline`, imports rewritten to `@mvfm/core`. Never modified — if a koan fails, fix core.
2. **Golden test suite** (500+ end-to-end tests): generated before any implementation begins. Each test follows the canonical flow `mvfm → app → dagql → fold → expect`. Covers runtime behavior, type-level assertions, and `@ts-expect-error` negative cases.

Implementation proceeds by deleting `packages/core/src/` and rebuilding from the koan chain. The test fortress provides continuous pass/fail signals.

## Phase A: Build the Test Fortress

All tests written before any implementation code. No exceptions.

### A1: Koan gates

- Copy 20 koan files into `packages/core/src/__koans__/`
- Create thin wrapper test files that rewrite imports to `@mvfm/core`
- Each koan is both a `tsc --noEmit --strict` gate and a runtime gate

### A2: Golden tests from docs

The 105 doc examples (core, num, str, boolean, eq, ord, console, st, control, error, fiber) each become a golden test. Pattern: `s/foldAST/fold/g`, wrap in `test()`, assert expected output. This is the completeness checklist — every public API method gets at least one test.

### A3: Golden tests — design space exploration

Subagents systematically generate tests across these dimensions:

| Dimension | Examples |
|-----------|----------|
| **Plugin combinations** | num+str+eq, num+ord+boolean, all plugins, minimal plugins |
| **Trait dispatch** | eq on numbers vs strings vs booleans, ord dispatch, show dispatch |
| **DAG operations** | select→map→gc, replace→splice→commit, wrap→name→select |
| **Structural nodes** | records/tuples in fold, nested structural, accessor chains |
| **Error paths** | fail inside try, nested try/catch, settle with mixed results, guard |
| **Concurrency** | par with shared nodes, race, timeout, retry with memoization |
| **State** | let/get/set sequences, volatile taint propagation, push |
| **Type errors** | `@ts-expect-error` for wrong types, missing plugins, bad dispatch |
| **Edge cases** | empty programs, 10k-node chains (stack safety), diamond DAGs |
| **createApp extensibility** | custom plugins, ordPlugin, non-std registries |
| **Memoization** | shared DAG nodes evaluate once, volatile nodes re-evaluate |

Target: 500+ golden tests. Each is a self-contained `test()` block using the public API only.

### A4: Production extension tests

Tests for features beyond koans but required by the issue:

- **ST volatile/taint**: volatile nodes skip memo, taint propagates to dependents
- **Error propagation**: `gen.throw()`, error/try catches, error/fail throws
- **Fiber parallelism**: independent `fold()` calls from within handlers
- **Scoped lambdas**: yield type widens to `number | string | { child, scope }`
- **Stack safety**: 10k+ node chains don't overflow

These tests are written NOW, not during implementation.

## Phase B: Delete and Rebuild

### B1: Delete existing implementation

- Delete `packages/core/src/*` (all implementation files)
- Delete `packages/core/tests/*` (old internal tests, replaced by golden suite)
- Keep: `package.json`, `tsconfig.json`, build config, `__koans__/` directory

### B2: Rebuild following koan chain

Build order matches koan progression. After each group, corresponding golden tests should start passing.

| Stage | Koans | What to build |
|-------|-------|---------------|
| Primitives | 00–01 | CExpr, NExpr, phantom types, content-addressed construction, incrementId |
| Builders | 02–03 | Registry types, type-safe builders, trait dispatch |
| Composition | 03a | Unified Plugin type, RegistryOf, mvfmU, map builders |
| Normalization | 04 | app(), createApp(), type-level elaborator, elaborate() |
| Structural | 04a–04b | Structural elaboration, named map children, accessor overlay |
| DAG ops | 05–15 | Predicates, select, map, replace, gc, dirty, commit, wrap, splice, named, dagql |
| Fold | 16 | Trampoline fold, defaults(), handler yields, NExpr type inference |

### B3: Production extensions

Layer on top of koan-passing core:

- ST volatile/taint in fold memoization
- Error propagation through generator throw
- Fiber parallelism (independent fold calls)
- Scoped lambda yields
- Stack safety guarantees

### B4: Port fold handlers

Every handler switches from named field access to positional yield:

```ts
// Before (named fields):
"core/cond": async function* (node) {
  const pred = yield* eval_(node.predicate);
  return pred ? yield* eval_(node.then) : yield* eval_(node.else);
}

// After (positional yield):
"core/cond": async function* (_entry) {
  const pred = (yield 0) as boolean;
  return pred ? yield 1 : yield 2;
}
```

## Phase C: Validation

- All 20 koan gates pass (tsc + runtime)
- All golden tests pass
- `npm run build && npm run check && npm test` clean
- No `any` types or `as` casts in production code

## What Gets Deleted

- `packages/core/src/*` — entire implementation
- `packages/core/tests/*` — old internal tests
- `packages/core/src/__tests__/*` — old type tests

## What Gets Kept

- `packages/core/package.json`, `tsconfig.json`, build config
- Git history (behavioral reference during test authoring)
- `packages/core/src/__koans__/` (new, frozen fixtures)

## Risks

1. **Type-level completeness**: The hardest part. `Elaborate<Reg, CExpr>` must walk the type graph at compile time. Mitigated by extensive `@ts-expect-error` golden tests.
2. **Missing behavioral coverage**: Some existing behavior may not be covered by koans or docs. Mitigated by thorough golden test generation and using docs as a checklist.
3. **External plugin compatibility**: Plugins in `packages/plugin-*/` import from `@mvfm/core`. The public API shape must remain compatible. Mitigated by including external plugin integration in golden tests.

## Halt Conditions

From the issue — stop and report if:
- A koan requires changing to pass
- A core feature can't be expressed with the koan model
- Memoization/taint semantics don't compose with an existing feature
- An existing test's semantics can't be preserved
