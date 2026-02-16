# Plugin Group Resolution + Prelude Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement nested plugin-group resolution in `mvfm` and add a core `prelude` export with approved plugin composition.

**Architecture:** Add runtime flattening and type-level flattening of plugin inputs in `packages/core/src/core.ts`, define `prelude` in `packages/core/src/prelude.ts`, export it from `packages/core/src/index.ts`, and validate behavior through dedicated core tests.

**Tech Stack:** TypeScript, Vitest, MVFM core plugin system.

---

### Task 1: Add failing tests for grouped plugin support (RED)

**Files:**
- Create: `packages/core/tests/plugin-groups.test.ts`
- Create: `packages/core/tests/prelude.test.ts`

**Step 1: Write runtime and type-shape coverage tests**
- Flat call compatibility
- `mvfm(prelude)` and `mvfm(...prelude)`
- User-defined groups
- Arbitrary nested groups
- Ordering behavior

**Step 2: Run tests and confirm failure**
Run:
- `pnpm --filter @mvfm/core run test -- tests/plugin-groups.test.ts`
- `pnpm --filter @mvfm/core run test -- tests/prelude.test.ts`

Expected: failures due missing group-resolution/prelude support.

### Task 2: Implement plugin input flattening in core (GREEN)

**Files:**
- Modify: `packages/core/src/core.ts`

**Step 1: Add plugin input types and flatten utility types**
- Add recursive plugin-input type for nested groups.
- Add tuple flatten helper types for `MergePlugins` compatibility.

**Step 2: Add runtime flattening function**
- Flatten nested plugin inputs to a flat plugin-definition list with stable order.

**Step 3: Wire `mvfm` to use flattened plugins for both runtime and type resolution**
- Preserve existing behavior for flat plugin arrays.

**Step 4: Re-run RED tests and expect pass**
Run:
- `pnpm --filter @mvfm/core run test -- tests/plugin-groups.test.ts`

### Task 3: Add and export `prelude` (GREEN)

**Files:**
- Create: `packages/core/src/prelude.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Define `prelude` constant with approved plugin set + TSDoc**
- Include only approved plugins.

**Step 2: Export from `src/index.ts`**
- Keep existing exports intact.

**Step 3: Re-run prelude tests**
Run:
- `pnpm --filter @mvfm/core run test -- tests/prelude.test.ts`

### Task 4: Update public docs

**Files:**
- Modify: `docs/plugin-authoring-guide.md`

**Step 1: Add grouped plugin usage examples**
- `mvfm(prelude)`
- `mvfm(...prelude)`
- nested user-defined group example.

### Task 5: Full verification

**Files:**
- Modify as needed to satisfy checks.

**Step 1: Core package verification**
Run:
- `pnpm --filter @mvfm/core run build`
- `pnpm --filter @mvfm/core run check`
- `pnpm --filter @mvfm/core run test`

**Step 2: Repo verification**
Run:
- `pnpm run build`
- `pnpm run check`
- `pnpm run test`

### Task 6: Commit

**Step 1: Commit changes**
```bash
git add packages/core docs/plugin-authoring-guide.md docs/plans/2026-02-16-plugin-group-resolution-design.md docs/plans/2026-02-16-plugin-group-resolution-plan.md
git commit -m "feat(core): support nested plugin groups and add prelude"
```
