# Zod Typed Node Interfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `any`-typed zod interpreter handler inputs and isolate Zod v4 type-gap casts in one compat module, while preserving runtime behavior.

**Architecture:** Keep the current zod interpreter structure and per-kind split. Harden handler and helper signatures with explicit node interfaces in `types.ts`, and route known Zod API type gaps through a dedicated compat wrapper.

**Tech Stack:** TypeScript, Vitest, pnpm workspace.

---

### Task 1: Add failing regression test for compat-backed wrapper behavior

**Files:**
- Modify: `packages/plugin-zod/tests/interpreter.test.ts`

**Steps:**
1. Add one focused test covering tuple rest and prefault/nonoptional path that currently depends on Zod methods with type gaps.
2. Run plugin-zod interpreter tests and confirm failure only if typing refactor introduces regression.

### Task 2: Introduce typed schema node interfaces

**Files:**
- Modify: `packages/plugin-zod/src/types.ts`

**Steps:**
1. Add typed lambda node interfaces used by preprocess/transform/refinement helpers.
2. Add schema node base + per-wrapper/per-structure node types used by interpreter dispatch.
3. Add `AnyZodSchemaNode` union for recursive schema build signatures.

### Task 3: Type interpreter dispatch and isolate Zod type gaps

**Files:**
- Create: `packages/plugin-zod/src/zod-compat.ts`
- Modify: `packages/plugin-zod/src/interpreter.ts`

**Steps:**
1. Add compat wrappers for `nonoptional`, `prefault`, and tuple `rest`.
2. Replace inline `as any` casts in `interpreter.ts` with compat functions.
3. Update `buildSchemaGen`, parse helpers, transform/preprocess helpers, and parse handlers to typed node inputs.

### Task 4: Type per-kind handlers and schema build function signatures

**Files:**
- Modify: `packages/plugin-zod/src/interpreter-utils.ts`
- Modify: `packages/plugin-zod/src/string.ts`
- Modify: `packages/plugin-zod/src/number.ts`
- Modify: `packages/plugin-zod/src/bigint.ts`
- Modify: `packages/plugin-zod/src/date.ts`
- Modify: `packages/plugin-zod/src/enum.ts`
- Modify: `packages/plugin-zod/src/literal.ts`
- Modify: `packages/plugin-zod/src/primitives.ts`
- Modify: `packages/plugin-zod/src/special.ts`
- Modify: `packages/plugin-zod/src/object.ts`
- Modify: `packages/plugin-zod/src/array.ts`
- Modify: `packages/plugin-zod/src/union.ts`
- Modify: `packages/plugin-zod/src/intersection.ts`
- Modify: `packages/plugin-zod/src/map-set.ts`
- Modify: `packages/plugin-zod/src/record.ts`

**Steps:**
1. Add local typed node interfaces for handler inputs in each module.
2. Update handler signatures and schema build callback signatures to accept typed schema nodes.
3. Remove `node: any` usage from zod handler entry points.

### Task 5: Full verification

**Files:**
- No new files.

**Steps:**
1. Run `npm run build`.
2. Run `npm run check`.
3. Run `npm test`.
4. Record verification evidence for PR description.
