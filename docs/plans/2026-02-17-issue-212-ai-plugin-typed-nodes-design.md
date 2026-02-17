# Issue #212: Typed Node Interfaces for anthropic/openai

**Issue:** #212  
**Date:** 2026-02-17  
**Status:** Design approved

## Scope

Add typed node interfaces and `NodeTypeMap` registrations for all node kinds handled by:
- `packages/plugin-anthropic/src/0.74.0/interpreter.ts`
- `packages/plugin-openai/src/6.21.0/interpreter.ts`

Strict scope: interpreter typing only (`typedInterpreter`, typed node interfaces, `NodeTypeMap` augmentation). No plugin API changes.

## Architecture

For each plugin interpreter file:
1. Replace generic catch-all node interface with one exported interface per handled node kind.
2. Add `declare module "@mvfm/core"` augmentation to register every kind in `NodeTypeMap`.
3. Replace raw `Interpreter` object literal with `typedInterpreter<...>()({ ... })`.

This aligns with the typed-handler pattern established in #197 and used in typed plugin interpreters (for example postgres/redis).

## Type and Data Flow

`typedInterpreter` will enforce, at compile time, that each registered kind:
- has a handler,
- uses the correct node parameter type,
- cannot use `node: any` for registered kinds,
- returns a value compatible with the node phantom type.

For optional params/list APIs, node shapes will encode `params` as nullable/optional node references to match current runtime behavior.

## Testing and Validation

Use TDD at compile-time level:
- Add failing type tests under each plugin `src/__tests__/` folder that assert the new registrations are enforced (including `node:any` rejection).
- Run package build in RED state to confirm failure before implementation.
- Implement minimal typing changes in both interpreters.
- Re-run package build/check/tests, then repo-required verification commands:
  - `npm run build`
  - `npm run check`
  - `npm test`

Note: baseline workspace currently has unrelated recursive test failures in some plugin test packages due unresolved `@mvfm/core` entry; these will be reported if still present.

## Not in Scope

- Runtime behavior changes in anthropic/openai handlers.
- Plugin builder method signature changes.
- New operations/resources beyond the node kinds listed in issue #212.
