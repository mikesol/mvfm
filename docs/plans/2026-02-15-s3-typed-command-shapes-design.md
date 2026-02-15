# S3 Typed Command Shapes Design

## Context
Issue #89 requires replacing generic `Record<string, unknown>` method signatures in the S3 plugin with command-specific types from `@aws-sdk/client-s3`, while keeping runtime AST behavior unchanged.

## Chosen Approach
Use SDK utility-type inference against the aggregated `S3` client methods:
- input type: `Parameters<S3["methodName"]>[0]`
- output type: `Awaited<ReturnType<S3["methodName"]>>`

This keeps typings aligned with SDK updates and avoids manual duplication of `*Input/*Output` aliases.

## Scope
- Update S3 plugin TypeScript surface in `packages/plugin-s3/src/3.989.0/index.ts`.
- Preserve existing node kinds and interpreter/runtime behavior.
- Add compile-time type assertions in existing plugin tests to verify method signatures and return-shape fidelity.

## Non-goals
- Expanding command coverage beyond the existing 5 implemented operations.
- Changing AST schema or interpreter effect contracts.
- Refactoring integration tests beyond what is needed for typing validation.

## Validation
- Run focused plugin tests for AST behavior and new type assertions.
- Run package build/check.
- Run workspace-level verification commands required by project policy when feasible.

## Risks and Mitigations
- Risk: utility-type inference from overloaded SDK signatures can become awkward.
- Mitigation: keep a local alias per operation and constrain to the known single-input method shape used by the plugin.

- Risk: type-only changes accidentally alter runtime code.
- Mitigation: keep implementation body unchanged and rely on existing AST tests.
