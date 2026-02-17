# Issue 213 Typed Data Plugins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed node interfaces + `NodeTypeMap` registration and `typedInterpreter` enforcement for fetch, s3, and cloudflare-kv interpreters, with compile-time type tests.

**Architecture:** Keep typed node definitions local to each plugin `interpreter.ts`, add module augmentation there, and migrate each interpreter factory to `typedInterpreter<...>()`. Add compile-time tests under plugin `src/__tests__` to enforce handler typing for the newly registered kinds.

**Tech Stack:** TypeScript, `@mvfm/core` typed interpreter APIs, pnpm workspace build/check/test.

---

### Task 1: Type fetch interpreter

**Files:**
- Modify: `packages/plugin-fetch/src/whatwg/interpreter.ts`
- Test: `packages/plugin-fetch/src/__tests__/node-type-map.type-test.ts`

1. Add exported interfaces for `fetch/request`, `fetch/json`, `fetch/text`, `fetch/status`, `fetch/headers`.
2. Add `declare module "@mvfm/core"` `NodeTypeMap` entries for those kinds.
3. Replace object-literal interpreter return with `typedInterpreter<FetchKind>()({...})`.
4. Add compile-time type tests with positive and `@ts-expect-error` negative cases.

### Task 2: Type s3 interpreter

**Files:**
- Modify: `packages/plugin-s3/src/3.989.0/interpreter.ts`
- Test: `packages/plugin-s3/src/__tests__/node-type-map.type-test.ts`

1. Add exported interfaces for each `s3/*` kind in issue scope.
2. Add `NodeTypeMap` augmentation.
3. Use `typedInterpreter<S3Kind>()({...})` and keep current command dispatch logic.
4. Add compile-time type tests for correct and incorrect handler node parameter types.

### Task 3: Type cloudflare-kv interpreter

**Files:**
- Modify: `packages/plugin-cloudflare-kv/src/4.20260213.0/interpreter.ts`
- Test: `packages/plugin-cloudflare-kv/src/__tests__/node-type-map.type-test.ts`

1. Add exported interfaces for each `cloudflare-kv/*` kind in issue scope.
2. Add `NodeTypeMap` augmentation.
3. Switch to `typedInterpreter<CloudflareKvKind>()({...})`.
4. Add compile-time type tests for positive and negative cases.

### Task 4: Validate workspace

**Files:**
- Verify: all modified files

1. Run `pnpm build`.
2. Run `pnpm check`.
3. Run `pnpm test`.
4. Confirm no unintended file changes and capture outputs for PR notes.
