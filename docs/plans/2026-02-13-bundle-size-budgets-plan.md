# Bundle Size Budgets & Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add size-limit-based bundle size budgets with CI enforcement so bundle bloat is caught automatically on every PR.

**Architecture:** size-limit with @size-limit/preset-small-lib (esbuild internally) measures tree-shaken bundle sizes for 5 layered import configurations. Budgets are defined in `.size-limit.json`. CI enforcement via `andresz1/size-limit-action` posts size diffs as PR comments and fails the check on budget violations.

**Tech Stack:** size-limit, @size-limit/preset-small-lib, GitHub Actions

**Design doc:** `docs/plans/2026-02-13-bundle-size-budgets-design.md`

---

### Task 1: Enable tree-shaking signal in package.json

**Files:**
- Modify: `package.json`

**Step 1: Add `sideEffects: false` to package.json**

Add the `"sideEffects": false` field to `package.json` after the `"types"` field:

```json
"types": "dist/index.d.ts",
"sideEffects": false,
```

This tells bundlers (including esbuild inside size-limit) that all modules in this package are safe to tree-shake — no module has import-time side effects.

**Step 2: Verify the build still works**

Run: `npm run build && npm run check && npm test`
Expected: All pass with no changes to behavior.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add sideEffects false for tree-shaking"
```

---

### Task 2: Install size-limit dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install the preset**

Run: `npm install --save-dev size-limit @size-limit/preset-small-lib`

This installs size-limit plus the preset which pulls in `@size-limit/esbuild` and `@size-limit/file`.

**Step 2: Add the `size` script to package.json**

In the `"scripts"` section of `package.json`, add:

```json
"size": "size-limit"
```

Place it after the `"test"` script.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install size-limit with preset-small-lib"
```

---

### Task 3: Create .size-limit.json with entries (no limits yet)

**Files:**
- Create: `.size-limit.json`

**Step 1: Create the config file**

Create `.size-limit.json` at project root with 5 entries. No `limit` fields yet — we need to measure baselines first:

```json
[
  {
    "name": "Minimal pure-logic (num + eq)",
    "path": "dist/index.js",
    "import": "{ num, eq }"
  },
  {
    "name": "Medium prelude (num + str + eq + boolean + control)",
    "path": "dist/index.js",
    "import": "{ num, str, eq, boolean, control }"
  },
  {
    "name": "External service (postgres)",
    "path": "dist/index.js",
    "import": "{ postgres, postgresInterpreter }"
  },
  {
    "name": "External service (stripe)",
    "path": "dist/index.js",
    "import": "{ stripe, stripeInterpreter }"
  },
  {
    "name": "Full bundle",
    "path": "dist/index.js",
    "import": "*"
  }
]
```

**Step 2: Build and run size-limit to see baselines**

Run: `npm run build && npx size-limit`

Expected: A table showing the size of each entry. Record these numbers — they become the basis for budgets. Pay special attention to whether "Minimal pure-logic" is significantly smaller than "Full bundle". If they are similar sizes, tree-shaking is not working and we need to investigate before proceeding.

**Step 3: Commit (without limits — those come next)**

```bash
git add .size-limit.json
git commit -m "chore: add size-limit config with 5 measurement entries"
```

---

### Task 4: Set budgets based on measured baselines

**Files:**
- Modify: `.size-limit.json`

**Step 1: Set limits at ~120% of measured baselines**

After running `npx size-limit` in the previous task and recording the actual sizes, add `"limit"` fields to each entry. Use ~120% of the measured value, rounded to a clean number.

For example, if the measurements were:
- Minimal pure-logic: 3.2 kB → set limit to `"4 kB"`
- Medium prelude: 5.1 kB → set limit to `"6.5 kB"`
- Postgres: 8.7 kB → set limit to `"11 kB"`
- Stripe: 7.3 kB → set limit to `"9 kB"`
- Full: 15.2 kB → set limit to `"19 kB"`

**Use the actual measured numbers.** The examples above are illustrative only.

The final config will look like:

```json
[
  {
    "name": "Minimal pure-logic (num + eq)",
    "path": "dist/index.js",
    "import": "{ num, eq }",
    "limit": "<MEASURED × 1.2, rounded> kB"
  },
  ...
]
```

**Step 2: Verify budgets pass**

Run: `npx size-limit`

Expected: All entries show sizes under their limits. No failures.

**Step 3: Commit**

```bash
git add .size-limit.json
git commit -m "chore: set initial size budgets based on measured baselines"
```

---

### Task 5: Add size-limit job to CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add the size-limit job**

Add a new `size` job to `.github/workflows/ci.yml`. The full updated file should be:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Format & Lint
        run: npm run check

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Test
        run: npm test

  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Key points:
- The `permissions: pull-requests: write` at the top level is required for the action to post PR comments
- The `size` job runs independently from `check` (parallel)
- The action handles `npm ci`, `npm run build`, and `npx size-limit` internally

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add size-limit budget check with PR comment reporting"
```

---

### Task 6: End-to-end verification

**Step 1: Run the full validation suite**

Run: `npm run build && npm run check && npm test && npm run size`

Expected: All pass. The `size` command prints a table with all 5 entries under their budgets.

**Step 2: Verify tree-shaking effectiveness**

Compare the "Minimal pure-logic" size to "Full bundle" size from the `npm run size` output. The minimal entry should be meaningfully smaller (at least 50% smaller) than the full bundle. If not, tree-shaking isn't working effectively and we should investigate — but that investigation is out of scope for this issue (file a follow-up).

**Step 3: Final commit (if any fixups needed)**

If any adjustments were needed during verification, commit them:

```bash
git add -A
git commit -m "chore: fixup size budget configuration"
```

---

### Task 7: Create PR

**Step 1: Push and create PR**

```bash
gh pr create --title "Add bundle size budgets and CI tracking" --body "$(cat <<'EOF'
## Summary

Closes #42

- Adds [size-limit](https://github.com/ai/size-limit) with `@size-limit/preset-small-lib` for bundle size measurement
- Defines 5 layered import configurations (minimal pure-logic → full bundle) with budgets at ~120% of measured baselines
- Adds CI job using `andresz1/size-limit-action` that posts size diffs as PR comments and fails on budget violations
- Adds `"sideEffects": false` to enable tree-shaking

## Design alignment

- **Deterministic, inspectable output**: Size budgets ensure the bundle remains auditable and predictable
- **Plugin isolation**: Per-plugin measurements verify tree-shaking keeps plugins independent

## Validation performed

- `npm run build && npm run check && npm test` — all pass
- `npm run size` — all 5 entries under budget
- Tree-shaking verified: minimal import is meaningfully smaller than full bundle

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
