# Issue #293: Core Rebuild Design

## Strategy

Rebuild `packages/core` around immutable validation gates and maximal end-to-end invariants.

Two gate layers define correctness:

1. **Frozen koans** (00-16 + 04a/04b): copied as immutable fixtures. If a koan fails, core changes; koans do not.
2. **Golden E2E fortress** (hundreds of cases): API-level tests using canonical flow

```ts
const app = mvfm(...plugins)
const prog = app(() => ...)
const prog2 = dagql(prog) // optional
const res = fold(defaults(prog2), prog2)
```

The design intentionally avoids internals-first testing. Behavior is specified by public-flow invariants, with strong type/runtime coverage.

## Architecture

- Koans are copied into `packages/core/src/__koans__/` and treated as read-only fixtures.
- Gate wrappers only rewrite imports to `@mvfm/core`; no koan logic edits.
- E2E tests become the primary regression suite. Internal tests are retained only when needed for gaps that cannot be expressed through full flow.
- Retrofit implementation follows koan progression and E2E failures.

## Components and Data Flow

### 1. Frozen koan harness

- Immutable koan fixtures
- Strict type gates (`tsc --noEmit --strict`)
- Runtime gates (`tsx`/`vitest` execution)

### 2. Golden E2E harness

Case-table and generated coverage across:

- Plugin tuples (std and extended)
- Trait dispatch permutations
- DAG operation compositions (`select/map/replace/gc/dirty/commit/wrap/splice/named/dagql`)
- Structural elaboration and accessor chains
- Fold protocol variants (numeric and string yields, structural children)
- Determinism/memoization/stack-safety invariants

### 3. Type assertion harness

`*.type-test.ts` files assert:

- Positive inference (registry derivation, fold output inference, createApp tuple inference)
- Negative contracts with `@ts-expect-error` (invalid kinds, invalid trait dispatch, invalid fold/defaults wiring)

### 4. Implementation retrofit track

- Core internals are reshaped as necessary to satisfy gates.
- Public API compatibility is preserved where required by current packages.
- New public exports include TSDoc.

## Execution Phases

### Phase 1: Build gates and E2E fortress first (TDD anchor)

- Copy koans and wire gate runners
- Port and expand existing tests into E2E-first suites
- Add exhaustive negative type tests (`@ts-expect-error`)
- Target hundreds of high-value full-flow tests before major rewrites

### Phase 2: Retrofit core to satisfy koans 00-04b

- Primitives, builders, unified plugin composition, `createApp`, structural/accessor behavior

### Phase 3: Retrofit DAG operations to satisfy koans 05-15

- Predicates, select/map/replace/gc/dirty/commit/wrap/splice/named/dagql

### Phase 4: Fold + production extensions (koan 16 and beyond)

- Base koan fold semantics
- ST volatile/taint, error propagation, fiber parallelism, scoped lambdas, stack safety

## Required Checkpoint

Per user direction, **mandatory pause between Phase 3 and Phase 4** for explicit check-in before fold production-extension work starts.

## Error Handling and Halt Policy

Stop immediately and report if:

- A koan appears to require modification
- A required semantic cannot be expressed in the koan model
- Memoization/taint semantics cannot compose without regressions
- Existing behavior cannot be preserved without spec conflict

If spec is wrong, open `spec-change` issue before proceeding.

## Validation Criteria

- All frozen koan gates pass (type + runtime)
- Golden E2E/type suites pass
- `npm run build && npm run check && npm test` passes in full workspace
- No `any` or `as` casts in production core code
- `createApp(...plugins)` works beyond std plugins
- Fold handles structural children via string yields and infers output from `NExpr`

## Risks and Mitigations

1. **Type-level complexity risk**
- Mitigation: aggressive negative type tests and inference assertions from day one.

2. **Coverage blind spots risk**
- Mitigation: generated E2E matrix + doc/example parity audit.

3. **Cross-package compatibility risk**
- Mitigation: retain end-to-end runs including downstream plugin packages during validation.
