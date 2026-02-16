# Plugin Group Resolution + Core Prelude Design (Issue #187)

## Goal
Allow `mvfm` to accept arbitrary nested plugin collections while preserving existing flat plugin usage, and add a default `prelude` plugin group for common core plugins.

## Approved Prelude Composition
In:
- `num`, `str`, `semiring`, `eq`, `ord`, `show`, `boolean`, `bounded`, `heytingAlgebra`, `semigroup`, `monoid`

Out:
- `control`, `error`, `fiber`, `st`

## Requirements
1. Existing calls like `mvfm(num, str, semiring)` must remain valid.
2. `mvfm(prelude)` must work.
3. `mvfm(...prelude)` must work.
4. User-defined plugin groups must work.
5. Arbitrary nested plugin groups must be flattened deterministically.
6. Type inference should remain usable for merged `$` methods.

## Architecture
### 1) Runtime plugin normalization
Add a flattening step in `mvfm` that normalizes input plugin arguments into a flat ordered list of plugin definitions before context construction.

Properties:
- Depth-first, left-to-right traversal
- Supports nested arrays/tuples
- Preserves relative order exactly
- Applies existing plugin factory resolution to each leaf plugin

### 2) Type-level flattening
Extend `mvfm`’s generic parameter model to accept nested plugin-input tuples and flatten them at the type level before applying `MergePlugins`.

Properties:
- `mvfm(prelude)` and `mvfm(...prelude)` both resolve plugin-contributed `$` methods
- Nested user tuples/arrays also resolve
- Existing flat tuple behavior preserved

### 3) Prelude export
Add a new exported constant `prelude` from `@mvfm/core` representing the approved default core plugin group.

Design choice:
- Define `prelude` in its own module (`src/prelude.ts`) with TSDoc
- Re-export from `src/index.ts`

### 4) Documentation updates
Update public docs (`docs/plugin-authoring-guide.md`) with examples for grouped plugin usage and user-defined plugin groups.

## Testing
Add focused core tests covering:
- Flat plugin calls still work
- `mvfm(prelude)`
- `mvfm(...prelude)`
- User-defined plugin groups
- Arbitrary nested plugin groups
- Order preservation semantics

## Risks and Mitigations
- Risk: Type-level recursion complexity
  - Mitigation: keep flattening utility simple tuple recursion only.
- Risk: Behavior drift in plugin ordering
  - Mitigation: explicit order-preservation tests with colliding method names.
- Risk: Circular imports for `prelude`
  - Mitigation: keep `prelude` in `src/prelude.ts` and export through index barrel.

## Non-goals
- No changes to trait semantics or interpreter semantics.
- No special-case behavior only for `prelude`.
