# TS File Size Rule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce Biome 300-line limits for TypeScript files and refactor all violating TS source/test files below the limit without TS suppressions.

**Architecture:** Biome will enforce a single nursery rule scoped to TypeScript file globs. Refactors will split oversized modules into focused sibling files while preserving current exports and runtime behavior. Test files will be split to mirror source concerns and keep each test file under 300 lines.

**Tech Stack:** TypeScript, Biome 2.3.15, pnpm workspace, Vitest

---

### Task 1: Enable Biome rule for TypeScript files

**Files:**
- Modify: `biome.json`

**Step 1: Add failing guardrail config**
Add `nursery.noExcessiveLinesPerFile` with `level: error` and `{ maxLines: 300, skipBlankLines: false }`.

**Step 2: Restrict includes to TypeScript only**
Set `files.includes` to `packages/*/src/**/*.ts` and `packages/*/tests/**/*.ts`.

**Step 3: Run check to verify red state**
Run: `pnpm run check`
Expected: FAIL with `nursery/noExcessiveLinesPerFile` violations in current oversized `.ts` files.

### Task 2: Split oversized source modules

**Files:**
- Modify/Create: offending files under `packages/*/src/**`

**Step 1: Pick one violating source file**
Extract cohesive groups (types/helpers/api segments) into sibling modules.

**Step 2: Keep API stable**
Re-export from original entry file or adjust internal imports while preserving external exports.

**Step 3: Verify local green for touched package**
Run: `pnpm --filter <package> build`
Expected: PASS.

**Step 4: Repeat until no source `.ts` file exceeds 300 lines**
Run: `pnpm run check`
Expected: source-file line-limit errors resolved.

### Task 3: Split oversized test modules

**Files:**
- Modify/Create: offending files under `packages/*/tests/**`

**Step 1: Partition tests by feature area**
Create focused test files to mirror source module boundaries.

**Step 2: Keep deterministic assertions unchanged**
Move suites without changing test behavior or expected outputs.

**Step 3: Verify package tests after each split**
Run: `pnpm --filter <package> test`
Expected: PASS.

**Step 4: Repeat until no test `.ts` file exceeds 300 lines**
Run: `pnpm run check`
Expected: no line-limit errors.

### Task 4: Full verification

**Files:**
- Modify: all touched files from tasks 1-3

**Step 1: Build workspace first**
Run: `pnpm build`
Expected: PASS.

**Step 2: Run lints/checks**
Run: `pnpm run check`
Expected: PASS.

**Step 3: Run tests**
Run: `pnpm test`
Expected: PASS.

**Step 4: Commit**
Run:
```bash
git add biome.json docs/plans/2026-02-16-ts-file-size-rule-design.md docs/plans/2026-02-16-ts-file-size-rule.md packages
git commit -m "chore: enforce ts file length rule and split oversized modules"
```
