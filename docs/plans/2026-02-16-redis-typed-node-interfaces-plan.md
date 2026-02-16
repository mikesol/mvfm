# Redis Typed Node Interfaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `any` from redis interpreter handlers by introducing typed node interfaces for all 35 node kinds, with no runtime behavior changes.

**Architecture:** Keep interpreter behavior unchanged while hardening the type layer. Define concrete node interfaces grouped by command family and update handler signatures to consume these types. Add compile-time and runtime regression tests.

**Tech Stack:** TypeScript, Vitest, pnpm workspace.

---

### Task 1: Add failing type regression tests

**Files:**
- Modify: `packages/plugin-redis/tests/5.4.1/index.test.ts`

**Steps:**
1. Add `expectTypeOf` checks for representative redis command return types (`get`, `set`, `hget`, `lrange`, etc.).
2. Add `@ts-expect-error` checks for invalid method arguments.
3. Run plugin-redis tests/checks to ensure type assertions exercise compiler behavior.

### Task 2: Replace `any` handler signatures with concrete per-kind interfaces

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`

**Steps:**
1. Define concrete interfaces for all 35 redis kinds grouped by existing section headers.
2. Keep shared base interfaces for repeated shapes while still defining concrete per-kind interfaces.
3. Update every handler signature to use its corresponding node interface.
4. Ensure no `node: any` remains in redis interpreter.

### Task 3: Verify runtime behavior remains stable

**Files:**
- Modify (if needed): `packages/plugin-redis/tests/5.4.1/interpreter.test.ts`

**Steps:**
1. Run redis interpreter tests.
2. Add targeted test adjustments only if type-driven fixes expose missing coverage.
3. Confirm command names and argument ordering remain unchanged.

### Task 4: Full verification

**Files:**
- No new files.

**Steps:**
1. Run `npm run build`.
2. Run `npm run check`.
3. Run `npm test`.
4. Record results for PR validation evidence.

