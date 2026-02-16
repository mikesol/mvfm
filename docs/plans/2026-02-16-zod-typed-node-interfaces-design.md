# Zod Typed Node Interfaces Design

## Context
Issue `#192` identifies pervasive `node: any` handler parameters and scattered `as any` casts in `packages/plugin-zod/src/interpreter.ts` and per-kind interpreter modules. The zod plugin already follows the new interpreter architecture, but type hardening is incomplete.

## Goals
- Define typed node interfaces for zod schema handler inputs.
- Replace `node: any` in zod interpreter handlers with typed interfaces.
- Type parse handlers with `ValidationASTNode`.
- Isolate Zod v4 API type gaps into one compat file.
- Keep runtime behavior unchanged.

## Non-goals
- No schema DSL behavior changes.
- No upstream Zod type fixes.
- No broad plugin architecture changes.

## Design
### 1. Typed node model in `types.ts`
Introduce a typed schema node model used by handlers:
- A base schema node shape with optional `checks`, `refinements`, and `error`.
- Wrapper node types for kinds handled in `interpreter.ts` (`optional`, `nullable`, `tuple`, `transform`, `pipe`, etc.).
- A union type (`AnyZodSchemaNode`) used for schema recursion.
- A typed lambda node shape for transform/preprocess/refinement evaluation.

### 2. Interpreter typing
In `interpreter.ts`:
- Type `buildSchemaGen` against schema union types instead of `any`.
- Type parse helper functions (`parseErrorOpt`, refinement/transform extractors, lambda evaluator, `handleParse`) using `ValidationASTNode` and typed helper interfaces.
- Keep control flow and runtime behavior identical.

### 3. Per-kind handler typing
In each per-kind handler module:
- Add local node interfaces for the fields each handler reads.
- Update handler signatures from `node: any` to typed interfaces.
- Keep existing schema-building behavior unchanged.

### 4. Zod compat wrapper
Add `zod-compat.ts` for Zod v4 methods missing from public type surfaces:
- nonoptional
- prefault
- tuple rest

Interpreter code calls wrappers instead of inline `as any` casts.

## Risks and mitigations
- Risk: accidental behavior drift while touching many signatures.
- Mitigation: keep edits type-focused, preserve logic order, run full workspace verification.
- Risk: over-constraining node interfaces relative to actual AST shape.
- Mitigation: use optional fields where AST currently allows omission and align with builder output tests.

## Validation
- `npm run build`
- `npm run check`
- `npm test`
