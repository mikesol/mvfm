# Issue #211: Typed Node Interfaces for str/eq/ord

**Issue:** #211
**Date:** 2026-02-16
**Status:** Design approved

## Scope

Add typed node interfaces and `NodeTypeMap` registrations for all node kinds handled by:
- `str` plugin interpreter
- `eq` plugin interpreter
- `ord` plugin interpreter

This includes `str/startsWith` and `str/endsWith` in addition to the kinds listed in the issue body.

## Architecture

Keep each plugin interpreter self-contained by:
1. Defining exported typed node interfaces in its interpreter file.
2. Adding `declare module "@mvfm/core"` augmentation mapping every handled kind to its interface.
3. Wrapping handlers in `typedInterpreter<...>()({ ... })`.

This matches the pattern established in #197 and already used by `plugin-redis` and `plugin-postgres`.

## Type and Data Flow

`typedInterpreter` will enforce, at compile time, that each registered kind:
- has a handler,
- uses the correct node parameter type,
- does not use `node: any` for registered kinds,
- returns a value compatible with the node phantom type.

All node interfaces in these interpreters will be exported to support reuse and API extraction consistency.

## Testing and Validation

Add compile-time checks in `packages/core/src/__tests__/node-type-map.type-test.ts` covering:
- positive typed interpreter construction for `str`, `eq`, `ord` kinds,
- negative checks that wrong handler node types are rejected.

Run required validation commands:
- `npm run build`
- `npm run check`
- `npm test`

## Not in Scope

- Runtime behavior changes for string/equality/ordering operations.
- Refactoring plugin architecture beyond typed handler registration.
- Changing node shapes in plugin `index.ts` builders unless needed for type correctness.
