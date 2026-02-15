# Plugin Directory Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all plugins from flat files to directory-based layout with colocated interpreters, per the design in `docs/plans/2026-02-12-reference-plugin-stack-design.md`.

**Architecture:** Pure mechanical restructure — no behavior changes. Each plugin becomes a directory containing `index.ts` (plugin definition) and optionally `interpreter.ts` (interpreter fragment). Postgres gains a versioned subdirectory (`3.4.8/`). All test files mirror the new source structure. TypeScript's `directory/index.ts` resolution means most external imports don't need updating.

**Tech Stack:** TypeScript, vitest, git mv

**Working directory:** `/home/mikesol/Documents/GitHub/mvfm/mvfm/.worktrees/issue-24`

**Baseline:** 191 tests passing, clean build.

---

## File Movement Map

### Source files

| Old path | New path | Internal import change |
|---|---|---|
| `src/plugins/boolean.ts` | `src/plugins/boolean/index.ts` | `../core` → `../../core` |
| `src/plugins/control.ts` | `src/plugins/control/index.ts` | `../core` → `../../core` |
| `src/plugins/eq.ts` | `src/plugins/eq/index.ts` | `../core` → `../../core` |
| `src/plugins/error.ts` | `src/plugins/error/index.ts` | `../core` → `../../core` |
| `src/plugins/fiber.ts` | `src/plugins/fiber/index.ts` | `../core` → `../../core` |
| `src/plugins/num.ts` | `src/plugins/num/index.ts` | `../core` → `../../core` |
| `src/plugins/str.ts` | `src/plugins/str/index.ts` | `../core` → `../../core` |
| `src/plugins/st.ts` | `src/plugins/st/index.ts` | `../core` → `../../core` |
| `src/plugins/postgres.ts` | `src/plugins/postgres/3.4.8/index.ts` | `../core` → `../../../core` |
| `src/interpreters/boolean.ts` | `src/plugins/boolean/interpreter.ts` | `../core` → `../../core` |
| `src/interpreters/num.ts` | `src/plugins/num/interpreter.ts` | `../core` → `../../core` |
| `src/interpreters/str.ts` | `src/plugins/str/interpreter.ts` | `../core` → `../../core` |
| `src/interpreters/core.ts` | *(stays)* | *(no change)* |

### Test files

| Old path | New path |
|---|---|
| `tests/plugins/boolean.test.ts` | `tests/plugins/boolean/index.test.ts` |
| `tests/plugins/control.test.ts` | `tests/plugins/control/index.test.ts` |
| `tests/plugins/eq.test.ts` | `tests/plugins/eq/index.test.ts` |
| `tests/plugins/error.test.ts` | `tests/plugins/error/index.test.ts` |
| `tests/plugins/fiber.test.ts` | `tests/plugins/fiber/index.test.ts` |
| `tests/plugins/num.test.ts` | `tests/plugins/num/index.test.ts` |
| `tests/plugins/str.test.ts` | `tests/plugins/str/index.test.ts` |
| `tests/plugins/st.test.ts` | `tests/plugins/st/index.test.ts` |
| `tests/plugins/postgres.test.ts` | `tests/plugins/postgres/3.4.8/index.test.ts` |
| `tests/interpreters/num.test.ts` | `tests/plugins/num/interpreter.test.ts` |
| `tests/interpreters/str.test.ts` | `tests/plugins/str/interpreter.test.ts` |
| `tests/interpreters/eq.test.ts` | `tests/plugins/eq/interpreter.test.ts` |
| `tests/interpreters/core.test.ts` | *(stays)* |

### Files that stay unchanged (no import changes needed)

These root-level test files import plugins via `../src/plugins/{name}`, which resolves to `../src/plugins/{name}/index.ts` automatically:

- `tests/core.test.ts`
- `tests/composition.test.ts`
- `tests/rec.test.ts`
- `tests/schema.test.ts`
- `tests/types.test.ts`

### `src/index.ts` export path changes

Only interpreter and postgres exports change. Plugin exports like `./plugins/boolean` still resolve via index.ts.

| Old export path | New export path |
|---|---|
| `./interpreters/boolean` | `./plugins/boolean/interpreter` |
| `./interpreters/num` | `./plugins/num/interpreter` |
| `./interpreters/str` | `./plugins/str/interpreter` |
| `./plugins/postgres` | `./plugins/postgres/3.4.8` |
| `./interpreters/core` | *(stays)* |

---

## Task 1: Move mvfm-native plugin source files to directories

**Files:**
- Move: All 8 mvfm-native plugins (boolean, control, eq, error, fiber, num, str, st)

**Step 1: Create directories and move files**

```bash
cd /home/mikesol/Documents/GitHub/mvfm/mvfm/.worktrees/issue-24
for name in boolean control eq error fiber num str st; do
  mkdir -p src/plugins/$name
  git mv src/plugins/$name.ts src/plugins/$name/index.ts
done
```

**Step 2: Update internal imports in all 8 files**

In each `src/plugins/{name}/index.ts`, replace:
```ts
from "../core"
```
with:
```ts
from "../../core"
```

This applies to all import lines in all 8 files. Each file has 1 import from `../core`.

**Step 3: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build passes, 191 tests pass. External imports like `../plugins/boolean` resolve to `../plugins/boolean/index.ts` automatically.

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: move mvfm-native plugins to directory layout"
```

---

## Task 2: Move postgres to versioned directory

**Files:**
- Move: `src/plugins/postgres.ts` → `src/plugins/postgres/3.4.8/index.ts`
- Modify: `src/index.ts` (postgres export paths)

**Step 1: Create versioned directory and move file**

```bash
mkdir -p src/plugins/postgres/3.4.8
git mv src/plugins/postgres.ts src/plugins/postgres/3.4.8/index.ts
```

**Step 2: Update internal import in postgres plugin**

In `src/plugins/postgres/3.4.8/index.ts`, replace:
```ts
from "../core"
```
with:
```ts
from "../../../core"
```

**Step 3: Update `src/index.ts` postgres exports**

Replace:
```ts
export type { PostgresConfig, PostgresMethods } from "./plugins/postgres";
export { postgres } from "./plugins/postgres";
```
with:
```ts
export type { PostgresConfig, PostgresMethods } from "./plugins/postgres/3.4.8";
export { postgres } from "./plugins/postgres/3.4.8";
```

**Step 4: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build passes, 191 tests pass. Test file `tests/plugins/postgres.test.ts` imports `../../src/plugins/postgres` — this no longer resolves (there's no `src/plugins/postgres/index.ts`). If tests fail here, update the test import from `../../src/plugins/postgres` to `../../src/plugins/postgres/3.4.8` to fix.

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: move postgres plugin to versioned directory (3.4.8)"
```

---

## Task 3: Colocate interpreter fragments with plugins

**Files:**
- Move: `src/interpreters/boolean.ts` → `src/plugins/boolean/interpreter.ts`
- Move: `src/interpreters/num.ts` → `src/plugins/num/interpreter.ts`
- Move: `src/interpreters/str.ts` → `src/plugins/str/interpreter.ts`
- Modify: `src/index.ts` (interpreter export paths)
- Modify: `tests/interpreters/eq.test.ts`, `tests/interpreters/num.test.ts`, `tests/interpreters/str.test.ts` (update imports to new source locations)

**Step 1: Move interpreter files**

```bash
git mv src/interpreters/boolean.ts src/plugins/boolean/interpreter.ts
git mv src/interpreters/num.ts src/plugins/num/interpreter.ts
git mv src/interpreters/str.ts src/plugins/str/interpreter.ts
```

**Step 2: Update internal imports in moved interpreter files**

In each `src/plugins/{name}/interpreter.ts`, replace:
```ts
from "../core"
```
with:
```ts
from "../../core"
```

**Step 3: Update `src/index.ts` interpreter exports**

Replace:
```ts
export { booleanInterpreter } from "./interpreters/boolean";
export { numInterpreter } from "./interpreters/num";
export { strInterpreter } from "./interpreters/str";
```
with:
```ts
export { booleanInterpreter } from "./plugins/boolean/interpreter";
export { numInterpreter } from "./plugins/num/interpreter";
export { strInterpreter } from "./plugins/str/interpreter";
```

**Step 4: Update interpreter test imports**

The interpreter test files still live at `tests/interpreters/` but now reference moved sources.

In `tests/interpreters/num.test.ts`, replace:
```ts
import { numInterpreter } from "../../src/interpreters/num";
```
with:
```ts
import { numInterpreter } from "../../src/plugins/num/interpreter";
```

In `tests/interpreters/str.test.ts`, replace:
```ts
import { strInterpreter } from "../../src/interpreters/str";
```
with:
```ts
import { strInterpreter } from "../../src/plugins/str/interpreter";
```

In `tests/interpreters/eq.test.ts`, replace all old interpreter imports:
```ts
import { booleanInterpreter } from "../../src/interpreters/boolean";
import { numInterpreter } from "../../src/interpreters/num";
import { strInterpreter } from "../../src/interpreters/str";
```
with:
```ts
import { booleanInterpreter } from "../../src/plugins/boolean/interpreter";
import { numInterpreter } from "../../src/plugins/num/interpreter";
import { strInterpreter } from "../../src/plugins/str/interpreter";
```

Note: `coreInterpreter` import stays as `../../src/interpreters/core` — it did not move.

**Step 5: Run build and tests**

```bash
npm run build && npm test
```

Expected: Build passes, 191 tests pass.

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: colocate interpreter fragments with their plugins"
```

---

## Task 4: Move plugin test files to directories

**Files:**
- Move: 8 mvfm-native plugin test files + 1 postgres test file

**Step 1: Create test directories and move files**

```bash
for name in boolean control eq error fiber num str st; do
  mkdir -p tests/plugins/$name
  git mv tests/plugins/$name.test.ts tests/plugins/$name/index.test.ts
done
mkdir -p tests/plugins/postgres/3.4.8
git mv tests/plugins/postgres.test.ts tests/plugins/postgres/3.4.8/index.test.ts
```

**Step 2: Update imports in all moved test files**

Each test file goes one level deeper, so all `../../` become `../../../`.

For each `tests/plugins/{name}/index.test.ts` (boolean, control, eq, error, fiber, num, str, st):
- Replace `../../src/` with `../../../src/` in ALL import paths

For `tests/plugins/postgres/3.4.8/index.test.ts`:
- Replace `../../src/` with `../../../../src/` in ALL import paths
- Also update the postgres import path if it was already changed in Task 2

**Examples:**

In `tests/plugins/boolean/index.test.ts`:
```ts
// Before:
import { mvfm } from "../../src/core";
import { boolean } from "../../src/plugins/boolean";
import { eq } from "../../src/plugins/eq";
import { num } from "../../src/plugins/num";
// After:
import { mvfm } from "../../../src/core";
import { boolean } from "../../../src/plugins/boolean";
import { eq } from "../../../src/plugins/eq";
import { num } from "../../../src/plugins/num";
```

In `tests/plugins/postgres/3.4.8/index.test.ts`:
```ts
// Before (post-Task 2):
import { mvfm } from "../../src/core";
import { postgres } from "../../src/plugins/postgres/3.4.8";
// After:
import { mvfm } from "../../../../src/core";
import { postgres } from "../../../../src/plugins/postgres/3.4.8";
```

**Step 3: Run build and tests**

```bash
npm run build && npm test
```

Expected: 191 tests pass.

**Step 4: Commit**

```bash
git add -A && git commit -m "refactor: move plugin test files to directory layout"
```

---

## Task 5: Move interpreter test files + final validation

**Files:**
- Move: `tests/interpreters/num.test.ts` → `tests/plugins/num/interpreter.test.ts`
- Move: `tests/interpreters/str.test.ts` → `tests/plugins/str/interpreter.test.ts`
- Move: `tests/interpreters/eq.test.ts` → `tests/plugins/eq/interpreter.test.ts`
- `tests/interpreters/core.test.ts` stays (core is not a plugin)

**Step 1: Move interpreter test files**

```bash
git mv tests/interpreters/num.test.ts tests/plugins/num/interpreter.test.ts
git mv tests/interpreters/str.test.ts tests/plugins/str/interpreter.test.ts
git mv tests/interpreters/eq.test.ts tests/plugins/eq/interpreter.test.ts
```

**Step 2: Update imports in moved test files**

These files move from depth 2 (`tests/interpreters/`) to depth 3 (`tests/plugins/{name}/`). All `../../src/` become `../../../src/`. Also update interpreter import paths (already pointing to new colocated locations from Task 3).

In `tests/plugins/num/interpreter.test.ts`:
```ts
// Before (post-Task 3):
import { composeInterpreters, mvfm } from "../../src/core";
import { coreInterpreter } from "../../src/interpreters/core";
import { numInterpreter } from "../../src/plugins/num/interpreter";
import { num } from "../../src/plugins/num";
// After:
import { composeInterpreters, mvfm } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { num } from "../../../src/plugins/num";
```

In `tests/plugins/str/interpreter.test.ts`:
```ts
// Before (post-Task 3):
import { composeInterpreters, mvfm } from "../../src/core";
import { coreInterpreter } from "../../src/interpreters/core";
import { strInterpreter } from "../../src/plugins/str/interpreter";
import { str } from "../../src/plugins/str";
// After:
import { composeInterpreters, mvfm } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { strInterpreter } from "../../../src/plugins/str/interpreter";
import { str } from "../../../src/plugins/str";
```

In `tests/plugins/eq/interpreter.test.ts`:
```ts
// Before (post-Task 3):
import { composeInterpreters, mvfm } from "../../src/core";
import { booleanInterpreter } from "../../src/plugins/boolean/interpreter";
import { coreInterpreter } from "../../src/interpreters/core";
import { numInterpreter } from "../../src/plugins/num/interpreter";
import { strInterpreter } from "../../src/plugins/str/interpreter";
import { boolean } from "../../src/plugins/boolean";
import { eq } from "../../src/plugins/eq";
import { num } from "../../src/plugins/num";
import { str } from "../../src/plugins/str";
// After:
import { composeInterpreters, mvfm } from "../../../src/core";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { coreInterpreter } from "../../../src/interpreters/core";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { strInterpreter } from "../../../src/plugins/str/interpreter";
import { boolean } from "../../../src/plugins/boolean";
import { eq } from "../../../src/plugins/eq";
import { num } from "../../../src/plugins/num";
import { str } from "../../../src/plugins/str";
```

**Step 3: Verify no stale import paths remain**

```bash
# Should return no matches (all old flat paths should be gone)
grep -r "from.*interpreters/boolean" src/ tests/ --include="*.ts" || echo "clean"
grep -r "from.*interpreters/num" src/ tests/ --include="*.ts" || echo "clean"
grep -r "from.*interpreters/str" src/ tests/ --include="*.ts" || echo "clean"
# These should ONLY match core interpreter references:
grep -r "from.*interpreters/core" src/ tests/ --include="*.ts"
# Should return no matches for flat plugin paths in source:
grep -r 'from.*plugins/boolean"' src/index.ts  # OK, these still resolve
```

**Step 4: Run full validation**

```bash
npm run build && npm run check && npm test
```

Expected: Clean build, lint passes, 191 tests pass.

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor: colocate interpreter tests with plugins, final cleanup"
```

---

## Post-restructure directory tree

```
src/
  core.ts
  schema.ts
  index.ts
  plugin-authoring-guide.ts
  interpreters/
    core.ts                          # core interpreter (not a plugin)
  plugins/
    boolean/
      index.ts                       # PluginDefinition + types
      interpreter.ts                 # InterpreterFragment
    control/
      index.ts
    eq/
      index.ts                       # no interpreter (delegates to type-specific plugins)
    error/
      index.ts
    fiber/
      index.ts
    num/
      index.ts
      interpreter.ts
    str/
      index.ts
      interpreter.ts
    st/
      index.ts
    postgres/
      3.4.8/
        index.ts

tests/
  core.test.ts
  composition.test.ts
  rec.test.ts
  schema.test.ts
  types.test.ts
  interpreters/
    core.test.ts                     # core interpreter tests
  plugins/
    boolean/
      index.test.ts
    control/
      index.test.ts
    eq/
      index.test.ts
      interpreter.test.ts           # end-to-end eq interpretation tests
    error/
      index.test.ts
    fiber/
      index.test.ts
    num/
      index.test.ts
      interpreter.test.ts
    str/
      index.test.ts
      interpreter.test.ts
    st/
      index.test.ts
    postgres/
      3.4.8/
        index.test.ts
```
