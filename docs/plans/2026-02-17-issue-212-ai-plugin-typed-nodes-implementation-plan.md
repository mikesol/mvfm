# Issue #212 AI Plugin Typed Nodes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce typed handler node parameters for all targeted `anthropic/*` and `openai/*` interpreter kinds via `NodeTypeMap` + `typedInterpreter`.

**Architecture:** Keep typing local to each affected interpreter file. Export node interfaces, augment `NodeTypeMap` in each plugin interpreter, and replace raw handler maps with `typedInterpreter` builders.

**Tech Stack:** TypeScript, module augmentation, `typedInterpreter`, tsc compile-time tests.

---

### Task 1: Add failing compile-time tests for anthropic/openai registrations

**Files:**
- Create: `packages/plugin-anthropic/src/__tests__/node-type-map.type-test.ts`
- Create: `packages/plugin-openai/src/__tests__/node-type-map.type-test.ts`

**Step 1: Write failing type tests**

Add compile-time tests with `@ts-expect-error` that expect `node:any` to be rejected for registered kinds (which should fail before registration exists).

**Step 2: Run test command to verify RED**

Run:
- `pnpm --filter @mvfm/plugin-anthropic run build`
- `pnpm --filter @mvfm/plugin-openai run build`

Expected: FAIL due unused `@ts-expect-error` before interpreter registration typing is added.

### Task 2: Type and register all anthropic interpreter kinds

**Files:**
- Modify: `packages/plugin-anthropic/src/0.74.0/interpreter.ts`

**Step 1: Export typed node interfaces**

Add exported node interfaces for:
- `anthropic/create_message`
- `anthropic/count_tokens`
- `anthropic/create_message_batch`
- `anthropic/retrieve_message_batch`
- `anthropic/list_message_batches`
- `anthropic/delete_message_batch`
- `anthropic/cancel_message_batch`
- `anthropic/retrieve_model`
- `anthropic/list_models`

**Step 2: Add `NodeTypeMap` augmentation**

Register all listed `anthropic/*` kinds via `declare module "@mvfm/core"`.

**Step 3: Switch to typed interpreter builder**

Replace raw object return with `typedInterpreter<...>()({ ... })` and typed handler params.

**Step 4: Verify GREEN for anthropic build**

Run: `pnpm --filter @mvfm/plugin-anthropic run build`
Expected: PASS.

### Task 3: Type and register all openai interpreter kinds

**Files:**
- Modify: `packages/plugin-openai/src/6.21.0/interpreter.ts`

**Step 1: Export typed node interfaces**

Add exported node interfaces for:
- `openai/create_chat_completion`
- `openai/retrieve_chat_completion`
- `openai/list_chat_completions`
- `openai/update_chat_completion`
- `openai/delete_chat_completion`
- `openai/create_embedding`
- `openai/create_moderation`
- `openai/create_completion`

**Step 2: Add `NodeTypeMap` augmentation**

Register all listed `openai/*` kinds via `declare module "@mvfm/core"`.

**Step 3: Switch to typed interpreter builder**

Replace raw object return with `typedInterpreter<...>()({ ... })` and typed handler params.

**Step 4: Verify GREEN for openai build**

Run: `pnpm --filter @mvfm/plugin-openai run build`
Expected: PASS.

### Task 4: Full verification and commit

**Files:**
- Create: `docs/plans/2026-02-17-issue-212-ai-plugin-typed-nodes-design.md`
- Create: `docs/plans/2026-02-17-issue-212-ai-plugin-typed-nodes-implementation-plan.md`
- Create: `packages/plugin-anthropic/src/__tests__/node-type-map.type-test.ts`
- Create: `packages/plugin-openai/src/__tests__/node-type-map.type-test.ts`
- Modify: `packages/plugin-anthropic/src/0.74.0/interpreter.ts`
- Modify: `packages/plugin-openai/src/6.21.0/interpreter.ts`

**Step 1: Run required project verification**

Run:
- `npm run build`
- `npm run check`
- `npm test`

Expected:
- build/check pass,
- report any pre-existing unrelated test failures if present.

**Step 2: Commit implementation**

Run:
```bash
git add docs/plans/2026-02-17-issue-212-ai-plugin-typed-nodes-design.md \
        docs/plans/2026-02-17-issue-212-ai-plugin-typed-nodes-implementation-plan.md \
        packages/plugin-anthropic/src/__tests__/node-type-map.type-test.ts \
        packages/plugin-openai/src/__tests__/node-type-map.type-test.ts \
        packages/plugin-anthropic/src/0.74.0/interpreter.ts \
        packages/plugin-openai/src/6.21.0/interpreter.ts
git commit -m "feat(plugins): type and register anthropic/openai interpreter node kinds"
```
