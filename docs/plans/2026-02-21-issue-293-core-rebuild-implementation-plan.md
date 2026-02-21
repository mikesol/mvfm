# Issue #293 Core Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `@mvfm/core` on the koan model, passing frozen koans 00-16 (+04a/04b), with a maximal API-level end-to-end test fortress and full workspace validation green.

**Architecture:** Copy koans as immutable gates, then drive all implementation through public-flow golden tests (`mvfm/createApp -> app -> dagql? -> defaults -> fold`). Use strict TDD: add failing runtime/type tests first, implement minimum core behavior to pass, and iterate by koan stage. Internals are only changed as required to satisfy external invariants.

**Tech Stack:** TypeScript 5, Vitest, tsx, Biome, API Extractor, pnpm workspaces.

---

### Task 1: Initialize branch workspace and baseline evidence

**Files:**
- Modify: `docs/plans/2026-02-21-issue-293-core-rebuild-implementation-plan.md`

**Step 1: Capture baseline state in the issue branch**

Run: `git status --short --branch`
Expected: clean or known branch-local changes only.

**Step 2: Capture baseline core test status**

Run: `pnpm --filter @mvfm/core test`
Expected: pass/fail output captured for comparison.

**Step 3: Capture full-workspace baseline status**

Run: `npm test`
Expected: may fail outside core; record exact failing packages.

**Step 4: Commit evidence note if needed**

If new note file is used, commit it; otherwise skip.

### Task 2: Add frozen koan fixtures to core

**Files:**
- Create: `packages/core/src/__koans__/00-expr.ts`
- Create: `packages/core/src/__koans__/01-increment.ts`
- Create: `packages/core/src/__koans__/02-build.ts`
- Create: `packages/core/src/__koans__/03-traits.ts`
- Create: `packages/core/src/__koans__/03a-composition.ts`
- Create: `packages/core/src/__koans__/04-normalize.ts`
- Create: `packages/core/src/__koans__/04a-structural.ts`
- Create: `packages/core/src/__koans__/04b-accessor.ts`
- Create: `packages/core/src/__koans__/05-predicates.ts`
- Create: `packages/core/src/__koans__/06-select.ts`
- Create: `packages/core/src/__koans__/07-map.ts`
- Create: `packages/core/src/__koans__/08-replace.ts`
- Create: `packages/core/src/__koans__/09-gc.ts`
- Create: `packages/core/src/__koans__/10-dirty.ts`
- Create: `packages/core/src/__koans__/11-commit.ts`
- Create: `packages/core/src/__koans__/12-wrap.ts`
- Create: `packages/core/src/__koans__/13-splice.ts`
- Create: `packages/core/src/__koans__/14-named.ts`
- Create: `packages/core/src/__koans__/15-dagql.ts`
- Create: `packages/core/src/__koans__/16-bridge.ts`
- Create: `packages/core/src/__koans__/README.md`

**Step 1: Copy koans from spike source without logic edits**

Run: `cp spike-koans/*.ts packages/core/src/__koans__/`
Expected: 20 koan files copied.

**Step 2: Add fixture immutability note**

In `packages/core/src/__koans__/README.md`, state koans are frozen gates and must not be edited.

**Step 3: Verify copied files match source**

Run: `diff -ru spike-koans packages/core/src/__koans__ --exclude STORY.md`
Expected: no logical diffs except allowed wrapper/import files not yet added.

**Step 4: Commit koan fixture import**

```bash
git add packages/core/src/__koans__
git commit -m "test(core): add frozen koan fixtures 00-16"
```

### Task 3: Build koan gate wrappers and runners (failing first)

**Files:**
- Create: `packages/core/tests/koans/00-expr.test.ts`
- Create: `packages/core/tests/koans/01-increment.test.ts`
- Create: `packages/core/tests/koans/02-build.test.ts`
- Create: `packages/core/tests/koans/03-traits.test.ts`
- Create: `packages/core/tests/koans/03a-composition.test.ts`
- Create: `packages/core/tests/koans/04-normalize.test.ts`
- Create: `packages/core/tests/koans/04a-structural.test.ts`
- Create: `packages/core/tests/koans/04b-accessor.test.ts`
- Create: `packages/core/tests/koans/05-predicates.test.ts`
- Create: `packages/core/tests/koans/06-select.test.ts`
- Create: `packages/core/tests/koans/07-map.test.ts`
- Create: `packages/core/tests/koans/08-replace.test.ts`
- Create: `packages/core/tests/koans/09-gc.test.ts`
- Create: `packages/core/tests/koans/10-dirty.test.ts`
- Create: `packages/core/tests/koans/11-commit.test.ts`
- Create: `packages/core/tests/koans/12-wrap.test.ts`
- Create: `packages/core/tests/koans/13-splice.test.ts`
- Create: `packages/core/tests/koans/14-named.test.ts`
- Create: `packages/core/tests/koans/15-dagql.test.ts`
- Create: `packages/core/tests/koans/16-bridge.test.ts`
- Create: `packages/core/tests/koans/shared/import-rewrites.ts`
- Create: `packages/core/tests/koans/tsconfig.koans.json`

**Step 1: Write wrappers that execute koans through public exports**

Each wrapper imports from `@mvfm/core` (or `../../src/index.ts` in-package), preserving koan test logic.

**Step 2: Add koan type-check config**

`tsconfig.koans.json` includes koan wrappers and strict/noEmit settings.

**Step 3: Run koan type gate to observe failures**

Run: `pnpm --filter @mvfm/core exec tsc -p tests/koans/tsconfig.koans.json --noEmit`
Expected: fails initially; errors become implementation backlog.

**Step 4: Run koan runtime gate to observe failures**

Run: `pnpm --filter @mvfm/core test -- tests/koans`
Expected: failing tests mapped to missing behavior.

**Step 5: Commit gate harness**

```bash
git add packages/core/tests/koans
git commit -m "test(core): add koan gate wrappers and strict runners"
```

### Task 4: Build E2E golden harness scaffold (failing first)

**Files:**
- Create: `packages/core/tests/golden/runtime/full-flow.test.ts`
- Create: `packages/core/tests/golden/runtime/create-app-extensibility.test.ts`
- Create: `packages/core/tests/golden/runtime/determinism-memoization.test.ts`
- Create: `packages/core/tests/golden/runtime/structural-children.test.ts`
- Create: `packages/core/tests/golden/runtime/stack-safety.test.ts`
- Create: `packages/core/tests/golden/type/full-flow.type-test.ts`
- Create: `packages/core/tests/golden/type/negative-contracts.type-test.ts`
- Create: `packages/core/tests/golden/shared/case-builders.ts`
- Create: `packages/core/tests/golden/shared/case-runner.ts`

**Step 1: Add minimal failing E2E runtime cases**

Use public-flow helper:

```ts
const program = app(() => add(num(1), num(2)))
const result = await fold(defaults(program), program)
expect(result).toBe(3)
```

**Step 2: Add failing type assertion cases**

- positive inference tests
- invalid usage cases with `@ts-expect-error`

**Step 3: Run runtime subset**

Run: `pnpm --filter @mvfm/core test -- tests/golden/runtime/full-flow.test.ts`
Expected: fails.

**Step 4: Run type subset**

Run: `pnpm --filter @mvfm/core exec tsc -p tsconfig.json --noEmit`
Expected: includes expected failures in new type tests until implementation catches up.

**Step 5: Commit scaffold**

```bash
git add packages/core/tests/golden
git commit -m "test(core): add end-to-end golden harness scaffold"
```

### Task 5: Expand golden matrix to hundreds of cases (parallel-safe)

**Files:**
- Modify: `packages/core/tests/golden/runtime/full-flow.test.ts`
- Modify: `packages/core/tests/golden/runtime/create-app-extensibility.test.ts`
- Modify: `packages/core/tests/golden/runtime/determinism-memoization.test.ts`
- Modify: `packages/core/tests/golden/runtime/structural-children.test.ts`
- Modify: `packages/core/tests/golden/runtime/stack-safety.test.ts`
- Modify: `packages/core/tests/golden/type/full-flow.type-test.ts`
- Modify: `packages/core/tests/golden/type/negative-contracts.type-test.ts`
- Create: additional files under `packages/core/tests/golden/runtime/` and `packages/core/tests/golden/type/` as needed (keep each <300 lines)

**Step 1: Author runtime families in independent files**

Families:
- traits/dispatch
- DAG op compositions
- structural/accessor chains
- error/control/fiber/st scenarios
- createApp/plugin tuple variants

**Step 2: Author type families in independent files**

Families:
- registry derivation and plugin tuple inference
- fold inference from `NExpr`
- invalid contracts with `@ts-expect-error`

**Step 3: Run golden suites repeatedly**

Run: `pnpm --filter @mvfm/core test -- tests/golden/runtime`
Run: `pnpm --filter @mvfm/core exec tsc -p tsconfig.json --noEmit`
Expected: red until retrofit lands.

**Step 4: Commit expanded fortress**

```bash
git add packages/core/tests/golden
git commit -m "test(core): expand end-to-end golden matrix"
```

### Task 6: Retrofit primitives/builders for koans 00-03a

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/builder.ts`
- Modify: `packages/core/src/core.ts`
- Modify: `packages/core/src/prelude.ts`
- Modify: `packages/core/src/defaults.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/trait-utils.ts`
- Create/Modify: supporting modules under `packages/core/src/` (split to stay <300 lines)

**Step 1: Run targeted failing gates**

Run: `pnpm --filter @mvfm/core test -- tests/koans/00-expr.test.ts tests/koans/01-increment.test.ts tests/koans/02-build.test.ts tests/koans/03-traits.test.ts tests/koans/03a-composition.test.ts`
Expected: failing.

**Step 2: Implement minimum code for 00-03a behavior**

Cover CExpr/NExpr, content addressing, registry builders, unified plugin composition and `RegistryOf`.

**Step 3: Re-run targeted gates + relevant golden tests**

Expected: 00-03a green.

**Step 4: Commit**

```bash
git add packages/core/src packages/core/tests/golden packages/core/tests/koans
git commit -m "feat(core): satisfy koans 00-03a and foundational golden cases"
```

### Task 7: Retrofit normalization + structural + accessor for koans 04/04a/04b

**Files:**
- Modify: `packages/core/src/core.ts`
- Modify: `packages/core/src/proxy.ts`
- Modify: `packages/core/src/schema.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/utils.ts`

**Step 1: Run failing koans 04-04b**

Run: `pnpm --filter @mvfm/core test -- tests/koans/04-normalize.test.ts tests/koans/04a-structural.test.ts tests/koans/04b-accessor.test.ts`
Expected: failing.

**Step 2: Implement `createApp`, generic elaborate, structural maps, deep accessor overlay**

**Step 3: Re-run koans + structural golden runtime/type tests**

Expected: 04/04a/04b green.

**Step 4: Commit**

```bash
git add packages/core/src packages/core/tests/golden packages/core/tests/koans
git commit -m "feat(core): satisfy koans 04-04b with createApp and structural accessors"
```

### Task 8: Retrofit DAG operations for koans 05-15

**Files:**
- Modify: `packages/core/src/core.ts`
- Modify: `packages/core/src/prelude.ts`
- Modify: `packages/core/src/index.ts`
- Modify: modules for predicates/select/map/replace/gc/dirty/commit/wrap/splice/named/dagql under `packages/core/src/`
- Modify: golden runtime/type files under `packages/core/tests/golden/`

**Step 1: Run koans 05-15 (red baseline)**

Run: `pnpm --filter @mvfm/core test -- tests/koans/05-predicates.test.ts tests/koans/06-select.test.ts tests/koans/07-map.test.ts tests/koans/08-replace.test.ts tests/koans/09-gc.test.ts tests/koans/10-dirty.test.ts tests/koans/11-commit.test.ts tests/koans/12-wrap.test.ts tests/koans/13-splice.test.ts tests/koans/14-named.test.ts tests/koans/15-dagql.test.ts`
Expected: failing.

**Step 2: Implement one operation family at a time (TDD loop per family)**

For each family:
- run specific failing tests
- implement minimal behavior
- rerun family tests
- avoid touching unrelated families

**Step 3: Re-run full koan suite + golden DAG suites**

Run: `pnpm --filter @mvfm/core test -- tests/koans tests/golden/runtime`
Expected: 05-15 green; remaining red concentrated in fold/extensions.

**Step 4: Commit**

```bash
git add packages/core/src packages/core/tests/golden packages/core/tests/koans
git commit -m "feat(core): satisfy koans 05-15 dag operations"
```

### Task 9: Mandatory check-in before fold production extensions

**Files:**
- Modify: `docs/plans/2026-02-21-issue-293-core-rebuild-implementation-plan.md` (status note optional)

**Step 1: Summarize status for user approval**

Include:
- koan pass status up through 15
- golden coverage count
- unresolved failures list

**Step 2: Request explicit go-ahead for Phase 4**

No Phase 4 coding until user confirms.

### Task 10: Retrofit fold bridge + defaults for koan 16

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/defaults.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/interpreters/core.ts`
- Modify: golden fold-related runtime/type tests

**Step 1: Run koan 16 (red baseline)**

Run: `pnpm --filter @mvfm/core test -- tests/koans/16-bridge.test.ts`
Expected: failing.

**Step 2: Implement koan 16 semantics first**

- structural string-child yields
- fold overload inference from `NExpr`
- unified plugin acceptance in `defaults`

**Step 3: Re-run koan 16 + fold golden tests**

Expected: green for koan-level fold.

**Step 4: Commit**

```bash
git add packages/core/src packages/core/tests/golden packages/core/tests/koans
git commit -m "feat(core): satisfy koan 16 fold bridge and defaults unification"
```

### Task 11: Add production fold extensions (post-koan)

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/interpreters/core.ts`
- Modify: `packages/core/src/plugins/st/interpreter.ts`
- Modify: `packages/core/src/plugins/error/interpreter.ts`
- Modify: `packages/core/src/plugins/fiber/interpreter.ts`
- Modify: `packages/core/tests/golden/runtime/*` (new extension-specific tests)

**Step 1: Add failing tests for each extension family**

- ST volatile/taint
- generator throw/error propagation
- nested fold fiber calls
- scoped lambda child+scope yields
- deep chain stack safety

**Step 2: Implement minimum extension logic**

**Step 3: Run extension suites**

Run: `pnpm --filter @mvfm/core test -- tests/golden/runtime`
Expected: extension tests green.

**Step 4: Commit**

```bash
git add packages/core/src packages/core/tests/golden
git commit -m "feat(core): add production fold extensions for st/error/fiber/scope"
```

### Task 12: API surface and documentation hygiene

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: any exported files touched in `packages/core/src/`
- Modify: `packages/core/etc/core.api.md`
- Modify: `packages/core/etc/core.api.json`

**Step 1: Add missing TSDoc on all new/changed public exports**

**Step 2: Update API extractor outputs**

Run: `pnpm --filter @mvfm/core run check`
Expected: API extractor clean.

**Step 3: Commit API surface updates**

```bash
git add packages/core/src packages/core/etc
git commit -m "docs(core): add TSDoc and update API reports"
```

### Task 13: Full verification before completion

**Files:**
- Modify: none required unless fixing failures

**Step 1: Run package-core verification**

Run: `pnpm --filter @mvfm/core run build`
Run: `pnpm --filter @mvfm/core run check`
Run: `pnpm --filter @mvfm/core run test`
Expected: all pass.

**Step 2: Run required workspace verification**

Run: `npm run build`
Run: `npm run check`
Run: `npm test`
Expected: all pass (or explicit pre-existing failures documented with evidence and user approval).

**Step 3: Commit final fixes if needed**

```bash
git add -A
git commit -m "chore(core): final issue #293 verification fixes"
```

### Task 14: PR preparation

**Files:**
- Modify: PR body via GitHub CLI

**Step 1: Create PR with required body sections**

Run: `gh pr create --repo mikesol/mvfm --base main --head issue-293-codex-0 --title "Port DAG model to core with frozen koan gates and golden E2E fortress" --body-file <prepared-file>`

PR body includes:
- `Closes #293`
- What this does (2-3 sentences)
- Design alignment vs VISION principles cited in issue
- Validation performed with command evidence

**Step 2: Wait for CI and report status**

Run: `gh pr checks <PR_NUMBER> --watch`
Expected: all checks green before merge request to user.

**Step 3: Do not merge**

Wait for explicit user authorization.
