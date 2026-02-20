# Koan Gap Closure Design

## Context

Spike koans (00-16) will serve as frozen validation gates for the LLM implementing `packages/core/`. Five gaps exist where an LLM could take shortcuts that pass all tests but produce broken code.

## Gaps and Closures

### Gap 1+4: `app()` hardcoded to StdRegistry / No `createApp` factory

**Problem**: `app()` reads module-level maps derived from `stdPlugins`. No test exercises a different registry. The `Reg` type parameter is never used at runtime.

**Closure in 04-normalize.ts**:
- Extract `elaborate(expr, liftMap, traitMap, kindInputs)` helper
- Add `createApp<P>(...plugins)` factory that builds maps and returns typed app
- `export const app = createApp(...stdPlugins)` for backward compat
- Type test: `AppResult<ExtReg, lt(3,4)>` resolves `num/lt`
- Runtime test: `createApp(...stdPlugins, ordPlugin)` elaborates `lt(3,4)` to `num/lt`

### Gap 2: `fold()` only handles `string[]` children

**Problem**: Structural nodes from 04a have named map children (`{x: "a", y: "b"}`). No test folds a structural node. fold() crashes on non-flat children.

**Closure in 16-bridge.ts**:
- Handler type widens to `AsyncGenerator<number | string, unknown, unknown>`
- fold() resolves string yields as direct node IDs: `typeof v === 'string' ? v : entry.children[v]`
- Test: fold `appS(point({x: add(1,2), y: 3}))` with named child access, assert `{x: 3, y: 3}`

### Gap 3: `fold<T>` always manually annotated

**Problem**: `T` is never inferred from NExpr. Callers always write `fold<number>(...)`.

**Closure in 16-bridge.ts**:
- Add overload: `fold(expr: NExpr<O,...>, interp): Promise<O>`
- Test: call `fold(prog, interp)` without annotation, assign to typed variable

### Gap 5: `PluginDef` / `Plugin` not unified

**Problem**: 16's `PluginDef` and 03a's `Plugin` are separate interfaces. `defaults()` only accepts `PluginDef`.

**Closure**:
- Add `nodeKinds` to 03a's `Plugin` interface
- Update all unified plugin definitions with `nodeKinds`
- `defaults()` in 16 accepts `Plugin[]`
- Test: feed `numPluginU` from 03a into `defaults()`

## File Changes

- **03a-composition.ts**: Export `ordPlugin`/`lt`, add `nodeKinds` to `Plugin`
- **04-normalize.ts**: Extract `elaborate()`, add `createApp()`, extended registry tests
- **16-bridge.ts**: Widen fold yield protocol, add fold overload, unify defaults(), structural fold test
