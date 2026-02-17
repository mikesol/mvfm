# Issue 233 Branded Interpreter Design

## Goal

Remove the untyped interpreter/program path and enforce end-to-end phantom kind typing by requiring branded `Interpreter<K>` values for `foldAST`.

## Scope

In scope:
- `@mvfm/core` interpreter/program/fold/defaults/builder type flow
- Plugin definition migration to `definePlugin()`
- Interpreter composition migration to `mergeInterpreters(...)`
- Type tests proving branding and any-rejection behavior
- Plugin callsites currently using `typedInterpreter(...)`

Out of scope:
- Runtime semantic changes to evaluator behavior
- New plugin features or new node kinds
- Any design deviations beyond issue #233 and its spike

## Chosen Approach

Use a strict RED migration exactly as issue #233 describes:
1. Introduce branded `Interpreter<K>` and phantom `Program<K>`.
2. Add only four trusted cast points:
   - `defineInterpreter<K>()`
   - `definePlugin(...)`
   - `defaults(...)`
   - `mergeInterpreters(...)`
3. Remove `typedInterpreter`, `typedFoldAST`, `CompleteInterpreter`, and untyped `Interpreter`/`Program`.
4. Fix all compile breaks by converting plugins/callsites to the new factories.

## Critical Constraints

- Stop immediately if any `as unknown as Interpreter<K>` is needed outside the four trusted cast points.
- Stop immediately if inference breaks in `mvfm()`/`defaults()` beyond what the spike describes.
- Keep file size rule intact (<300 lines per file).

## Testing Strategy

TDD-style for type-level behavior:
1. Update/create compile-time type tests for new negative/positive cases.
2. Run build/check to force type evaluation.
3. Run runtime tests to ensure no behavioral regressions.

Final verification command set:
- `pnpm build`
- `pnpm check`
- `pnpm test`

## Design Alignment

- Deterministic/verifiable core: branded factories make unsafe interpreter construction explicit and auditable.
- Plugin contract rigor: plugin definitions become typed factory outputs instead of structural object literals.
- Scale readiness: removes convention-only safety for generated plugins and replaces it with structural enforcement.
