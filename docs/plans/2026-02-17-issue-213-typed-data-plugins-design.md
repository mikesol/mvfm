# Issue 213 Typed Data Plugin Nodes Design

## Goal
Add concrete typed node interfaces and `NodeTypeMap` registration for `fetch/*`, `s3/*`, and `cloudflare-kv/*` node kinds, then enforce handler typing via `typedInterpreter` in each plugin interpreter.

## Scope
- In scope:
  - `packages/plugin-fetch/src/whatwg/interpreter.ts`
  - `packages/plugin-s3/src/3.989.0/interpreter.ts`
  - `packages/plugin-cloudflare-kv/src/4.20260213.0/interpreter.ts`
  - Compile-time type test files under each plugin `src/` tree
- Not in scope:
  - Runtime behavior changes
  - API surface expansion beyond listed node kinds
  - Moving interfaces to new `nodes.ts` modules

## Architecture
Use the existing interpreter files as the canonical home for typed node interfaces and module augmentation, matching current `plugin-postgres` style:
- Export a typed interface per node kind.
- Add `declare module "@mvfm/core" { interface NodeTypeMap { ... } }` for each kind.
- Replace untyped interpreter objects with `typedInterpreter<KindUnion>()({...})`.

## Data Flow
Data flow remains unchanged. Only TypeScript compile-time constraints change:
- Handler node params become strongly typed.
- Return types are validated against each node interface `TypedNode<T>` phantom type.
- Missing/wrong handler signatures fail at compile time.

## Error Handling
No runtime logic is added. Existing runtime error paths remain:
- `s3` unknown-kind guard remains in place.
- `fetch` and `cloudflare-kv` operation behavior remains as-is.

## Testing
Add compile-time-only type tests in each plugin `src/__tests__/` tree to validate:
- Positive: typed handlers compile.
- Negative: `@ts-expect-error` catches `any` and wrong node parameter types for registered kinds.

Validation commands after implementation:
- `pnpm build`
- `pnpm check`
- `pnpm test`
