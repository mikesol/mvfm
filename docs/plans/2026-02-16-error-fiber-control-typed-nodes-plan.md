# Error/Fiber/Control Typed Nodes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed node interfaces + NodeTypeMap registrations for error/fiber/control handlers, and provide default runtime interpretation for control loops.

**Architecture:** Convert existing error/fiber interpreter maps to `typedInterpreter` with module augmentation and add a new control interpreter module that executes loop nodes. Keep plugin emitters unchanged except wiring `control.defaultInterpreter`.

**Tech Stack:** TypeScript, Vitest, Biome, API Extractor, pnpm workspace.

---

### Task 1: Add failing tests for control default runtime behavior

**Files:**
- Create: `packages/core/tests/plugins/control/interpreter.test.ts`

**Step 1: Write the failing tests**
- Add tests that run `defaults(app)` with `control` and assert:
  - `control/each` updates state across all items.
  - `control/while` loops until condition becomes false.

**Step 2: Run test to verify it fails**
- Run: `pnpm --filter @mvfm/core test -- tests/plugins/control/interpreter.test.ts`
- Expected: FAIL due to missing interpreter handlers for `control/*`.

**Step 3: Write minimal implementation**
- Add control interpreter and wire plugin default interpreter.

**Step 4: Run test to verify it passes**
- Run: `pnpm --filter @mvfm/core test -- tests/plugins/control/interpreter.test.ts`
- Expected: PASS.

### Task 2: Add failing compile-time typed-handler coverage

**Files:**
- Modify: `packages/core/src/__tests__/node-type-map.type-test.ts`

**Step 1: Write the failing type tests**
- Add `typedInterpreter` tests for representative `error/*`, `fiber/*`, and `control/*` kinds.
- Include `@ts-expect-error` cases rejecting wrong node shapes.

**Step 2: Run check to verify it fails**
- Run: `pnpm --filter @mvfm/core run check`
- Expected: FAIL because those kinds are not in NodeTypeMap yet.

**Step 3: Write minimal implementation**
- Add module augmentations and typed interpreter maps in plugin interpreter files.

**Step 4: Run check to verify it passes**
- Run: `pnpm --filter @mvfm/core run check`
- Expected: PASS.

### Task 3: Implement typed interpreter conversion and NodeTypeMap registration

**Files:**
- Modify: `packages/core/src/plugins/error/interpreter.ts`
- Modify: `packages/core/src/plugins/fiber/interpreter.ts`
- Create: `packages/core/src/plugins/control/interpreter.ts`
- Modify: `packages/core/src/plugins/control/index.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Convert handler maps to typedInterpreter**
- Ensure each listed kind is handled with typed node parameter.

**Step 2: Add NodeTypeMap module augmentation in each interpreter file**
- Register all listed kinds against their interfaces.

**Step 3: Wire control default interpreter**
- Set `defaultInterpreter: controlInterpreter` on plugin definition.
- Export `controlInterpreter` from public index.

**Step 4: Verify focused tests**
- Run:
  - `pnpm --filter @mvfm/core test -- tests/plugins/control/interpreter.test.ts`
  - `pnpm --filter @mvfm/core run check`

### Task 4: Full verification

**Files:**
- No file changes required.

**Step 1: Run required repo checks**
- `pnpm run build && pnpm run check && pnpm run test`

**Step 2: Inspect git diff for scope correctness**
- Confirm only issue-relevant files changed.

**Step 3: Commit**
- Create commit with issue reference and concise summary.
