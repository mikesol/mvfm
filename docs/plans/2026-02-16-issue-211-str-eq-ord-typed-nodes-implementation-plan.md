# Issue #211 str/eq/ord Typed Nodes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce typed handler node parameters for all `str/*`, `eq/*`, and `ord/*` interpreter kinds via `NodeTypeMap` + `typedInterpreter`.

**Architecture:** Keep typing local to each affected interpreter file. Export node interfaces, augment `NodeTypeMap` in each plugin interpreter, and replace raw `Interpreter` maps with `typedInterpreter` builders for compile-time enforcement.

**Tech Stack:** TypeScript, module augmentation, `typedInterpreter`, tsc type tests.

---

### Task 1: Add failing compile-time tests for str/eq/ord registration behavior

**Files:**
- Modify: `packages/core/src/__tests__/node-type-map.type-test.ts`

**Step 1: Write failing type tests**

Add negative checks with `@ts-expect-error` that rely on `str`, `eq`, and `ord` kinds being registered and strongly typed.

**Step 2: Run test command to verify RED**

Run: `pnpm --filter @mvfm/core build`
Expected: FAIL with unused `@ts-expect-error` or type-mismatch expectations not being met before plugin registration.

**Step 3: Commit checkpoint (optional local)**

Run:
```bash
git add packages/core/src/__tests__/node-type-map.type-test.ts
git commit -m "test(core): add failing type checks for str eq ord node registrations"
```

### Task 2: Type and register all `str/*` interpreter node kinds

**Files:**
- Modify: `packages/core/src/plugins/str/interpreter.ts`

**Step 1: Export typed node interfaces**

Export interfaces for every handled node shape, including:
- `str/template`
- `str/concat`
- `str/upper`
- `str/lower`
- `str/trim`
- `str/slice`
- `str/includes`
- `str/startsWith`
- `str/endsWith`
- `str/split`
- `str/join`
- `str/replace`
- `str/len`
- `str/eq`
- `str/show`
- `str/append`
- `str/mempty`

**Step 2: Add `NodeTypeMap` augmentation**

Add `declare module "@mvfm/core" { interface NodeTypeMap { ... } }` with all `str/*` kinds.

**Step 3: Switch to typed interpreter builder**

Replace `Interpreter` object literal with:
- `typedInterpreter<...>()({ ... })`
- precise handler node interface parameters.

**Step 4: Verify GREEN for core build**

Run: `pnpm --filter @mvfm/core build`
Expected: PASS for `str` typing updates.

### Task 3: Type and register `eq/*` and `ord/*` interpreter node kinds

**Files:**
- Modify: `packages/core/src/plugins/eq/interpreter.ts`
- Modify: `packages/core/src/plugins/ord/interpreter.ts`

**Step 1: Export typed node interfaces**

Export:
- `EqNeq` for `eq/neq`
- `OrdCmp` (or equivalent per-kind typed interfaces) for `ord/gt|gte|lt|lte`

**Step 2: Add `NodeTypeMap` augmentations**

Add per-file `declare module "@mvfm/core"` entries for each kind.

**Step 3: Switch both interpreters to `typedInterpreter`**

Use explicit kind unions and typed handler params.

**Step 4: Verify GREEN for core build**

Run: `pnpm --filter @mvfm/core build`
Expected: PASS with eq/ord typed registration in place.

### Task 4: Final verification and commit

**Files:**
- Modify: `packages/core/src/__tests__/node-type-map.type-test.ts`
- Modify: `packages/core/src/plugins/str/interpreter.ts`
- Modify: `packages/core/src/plugins/eq/interpreter.ts`
- Modify: `packages/core/src/plugins/ord/interpreter.ts`
- Create: `docs/plans/2026-02-16-issue-211-str-eq-ord-typed-nodes-design.md`
- Create: `docs/plans/2026-02-16-issue-211-str-eq-ord-typed-nodes-implementation-plan.md`

**Step 1: Run required project verification**

Run:
- `npm run build`
- `npm run check`
- `npm test`

Expected:
- build/check pass,
- note and report any pre-existing unrelated test failures if present.

**Step 2: Commit implementation**

Run:
```bash
git add docs/plans/2026-02-16-issue-211-str-eq-ord-typed-nodes-design.md \
        docs/plans/2026-02-16-issue-211-str-eq-ord-typed-nodes-implementation-plan.md \
        packages/core/src/__tests__/node-type-map.type-test.ts \
        packages/core/src/plugins/str/interpreter.ts \
        packages/core/src/plugins/eq/interpreter.ts \
        packages/core/src/plugins/ord/interpreter.ts
git commit -m "feat(core): type and register str eq ord interpreter node kinds"
```
