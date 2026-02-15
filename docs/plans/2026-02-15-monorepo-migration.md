# Monorepo Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the single-package repo into a pnpm workspace monorepo, splitting 13 external-service plugins into separate `@mvfm/plugin-*` packages while keeping foundational plugins in `@mvfm/core`.

**Architecture:** pnpm workspace with `packages/core` and `packages/plugin-<name>` for each external-service plugin. Root `package.json` orchestrates builds. Each package has its own `tsconfig.json`, `api-extractor.json`, and independent build/test/check scripts.

**Tech Stack:** pnpm 10, TypeScript, Vitest, Biome, API Extractor, size-limit

---

## Context

**Core plugins (stay in `packages/core`):** num, str, eq, ord, semiring, semigroup, monoid, show, boolean, control, st, bounded, heyting-algebra, error, fiber

**External plugins (each gets `packages/plugin-<name>`):**

| Plugin | Version dir | SDK dependency |
|--------|-------------|----------------|
| anthropic | `0.74.0` | `@anthropic-ai/sdk` |
| cloudflare-kv | `4.20260213.0` | (Workers types) |
| fal | `1.9.1` | `@fal-ai/client` |
| fetch | `whatwg` | (native fetch) |
| openai | `6.21.0` | `openai` |
| pino | `10.3.1` | `pino` |
| postgres | `3.4.8` | `postgres` |
| redis | `5.4.1` | (ioredis) |
| resend | `6.9.2` | (resend) |
| s3 | `3.989.0` | `@aws-sdk/client-s3` |
| slack | `7.14.0` | `@slack/web-api` |
| stripe | `2025-04-30.basil` | `stripe` |
| twilio | `5.5.1` | (twilio) |

**Current import pattern in plugins:** `import { ... } from "../../../core"` — these become `import { ... } from "@mvfm/core"` after migration.

**Current import pattern in tests:** `import { ... } from "../../../../src/core"` — these become `import { ... } from "@mvfm/core"` (or `from "../../src/..."` within the same package).

---

### Task 1: Clean up stale worktree and create fresh branch

**Step 1: Remove old issue-72 worktree and branch**

```bash
cd /home/mikesol/Documents/GitHub/ilo/ilo
git worktree remove .worktrees/issue-72 --force
git branch -D issue-72
```

**Step 2: Create fresh worktree from main**

```bash
git worktree add ../mvfm-72 -b issue-72
```

**Step 3: Verify**

```bash
cd /home/mikesol/Documents/GitHub/ilo/mvfm-72
git log --oneline -1  # should match main HEAD ca631d9
```

---

### Task 2: Bootstrap pnpm workspace structure

All subsequent work happens in `/home/mikesol/Documents/GitHub/ilo/mvfm-72`.

**Step 1: Create `pnpm-workspace.yaml`**

Create file `pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

**Step 2: Create root `package.json`**

Replace root `package.json` with:
```json
{
  "private": true,
  "packageManager": "pnpm@10.6.3",
  "type": "module",
  "scripts": {
    "build": "pnpm -r --filter './packages/*' run build",
    "check": "pnpm -r --filter './packages/*' run check",
    "test": "pnpm -r --filter './packages/*' run test",
    "size": "pnpm -r --filter './packages/*' run size",
    "verify": "pnpm run build && pnpm run check && pnpm run test && pnpm run size"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.14",
    "@microsoft/api-extractor": "^7.56.3",
    "@size-limit/preset-small-lib": "^12.0.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "size-limit": "^12.0.0",
    "typescript": "^5.3.0",
    "vitest": "^4.0.18"
  },
  "lint-staged": {
    "*.{ts,js,json}": "biome check --write --no-errors-on-unmatched"
  }
}
```

**Step 3: Delete `package-lock.json`**

```bash
rm package-lock.json
```

**Step 4: Create `packages/` directory**

```bash
mkdir -p packages
```

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: bootstrap pnpm workspace structure"
```

---

### Task 3: Create `packages/core`

**Step 1: Create directory structure**

```bash
mkdir -p packages/core/src/plugins packages/core/src/interpreters packages/core/tests/plugins packages/core/tests/interpreters packages/core/etc
```

**Step 2: Move core source files**

Move these files from `src/` to `packages/core/src/`:
- `core.ts`
- `index.ts` (will be rewritten)
- `schema.ts`
- `trait-utils.ts`
- `interpreters/core.ts`

Move core plugin directories from `src/plugins/` to `packages/core/src/plugins/`:
- `boolean/`, `bounded/`, `control/`, `eq/`, `error/`, `fiber/`, `heyting-algebra/`, `monoid/`, `num/`, `ord/`, `semigroup/`, `semiring/`, `show/`, `st/`, `str/`

**Step 3: Move core test files**

Move from `tests/` to `packages/core/tests/`:
- `core.test.ts`, `composition.test.ts`, `rec.test.ts`, `schema.test.ts`, `step-evaluator.test.ts`, `types.test.ts`
- `interpreters/` (entire directory)
- `plugins/` subdirectories for core plugins only: `boolean/`, `bounded/`, `control/`, `eq/`, `error/`, `fiber/`, `heyting-algebra/`, `monoid/`, `num/`, `ord/`, `semigroup/`, `semiring/`, `show/`, `st/`, `str/`

**Step 4: Rewrite `packages/core/src/index.ts`**

Remove all external-plugin exports. Keep only:
- Core type/function exports from `./core`
- `coreInterpreter` from `./interpreters/core`
- All foundational plugin exports (boolean, bounded, control, eq, error, fiber, heyting-algebra, monoid, num, ord, semigroup, semiring, show, st, str)
- Schema/trait-utils exports

**Step 5: Fix import paths in core tests**

All core tests currently use relative paths like `../src/core` or `../../../src/plugins/num`. These need to be updated to the new relative paths within `packages/core/`. For example:
- `tests/core.test.ts` has `import { mvfm } from "../src/core"` → stays as `../src/core` (same relative position)
- `tests/plugins/num/index.test.ts` has `import { mvfm } from "../../../src/core"` → stays as `../../../src/core` (same relative position)

Since we're moving both `src/` and `tests/` together, relative paths within the package should remain the same.

**Step 6: Create `packages/core/package.json`**

```json
{
  "name": "@mvfm/core",
  "version": "0.0.1",
  "description": "Core DSL engine and foundational plugins for mvfm",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "biome check src tests && tsc -p tsconfig.json && api-extractor run --local",
    "test": "vitest run",
    "size": "size-limit"
  },
  "files": ["dist", "etc"],
  "devDependencies": {}
}
```

(No `devDependencies` here — tools are in root.)

**Step 7: Create `packages/core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "composite": true
  },
  "include": ["src/**/*"]
}
```

Note: `composite: true` is needed for project references between packages.

**Step 8: Create `packages/core/api-extractor.json`**

Copy from root `api-extractor.json` — same content, paths are relative.

**Step 9: Create `packages/core/.size-limit.json`**

```json
[
  {
    "name": "Minimal pure-logic (num + eq)",
    "path": "dist/index.js",
    "import": "{ num, eq }",
    "limit": "1 kB"
  },
  {
    "name": "Medium prelude (num + str + eq + boolean + control)",
    "path": "dist/index.js",
    "import": "{ num, str, eq, boolean, control }",
    "limit": "1.75 kB"
  }
]
```

**Step 10: Run build and test for core**

```bash
cd packages/core
pnpm run build
pnpm run test
```

Expected: both pass.

**Step 11: Commit**

```bash
git add -A && git commit -m "refactor: create @mvfm/core package with foundational plugins"
```

---

### Task 4: Create plugin packages (all 13)

For each external plugin, create `packages/plugin-<name>/`. This is highly repetitive, so do them all in one task.

**Step 1: For each plugin, create directory structure and move files**

For each plugin `P` with version dir `V`:

```bash
mkdir -p packages/plugin-P/src/V packages/plugin-P/tests/V packages/plugin-P/etc
```

Move `src/plugins/P/V/*` → `packages/plugin-P/src/V/`
Move `tests/plugins/P/V/*` → `packages/plugin-P/tests/V/`

**Step 2: Create `packages/plugin-P/src/index.ts`**

Each plugin package needs a barrel export file that re-exports everything from the versioned directory. Pattern (using postgres as example):

```typescript
export type { PostgresConfig, PostgresMethods } from "./3.4.8";
export { postgres } from "./3.4.8";
export { wrapPostgresJs } from "./3.4.8/client-postgres-js";
export type { ClientHandlerOptions, ClientHandlerState } from "./3.4.8/handler.client";
export { clientHandler } from "./3.4.8/handler.client";
export { serverEvaluate, serverHandler } from "./3.4.8/handler.server";
export type { PostgresClient } from "./3.4.8/interpreter";
export { escapeIdentifier, findCursorBatch, postgresInterpreter } from "./3.4.8/interpreter";
```

Copy the exact exports from the current `src/index.ts` for each plugin (stripping alias renames — in plugin packages the exports can use their natural names).

**Step 3: Fix import paths in plugin source files**

In each plugin's source files, replace:
- `import { ... } from "../../../core"` → `import { ... } from "@mvfm/core"`
- `import { ... } from "../../../schema"` → `import { ... } from "@mvfm/core"` (schema is re-exported from core index)
- `import { ... } from "../../../trait-utils"` → `import { ... } from "@mvfm/core"` (trait-utils is re-exported from core index)

Note: The core `index.ts` must export everything that plugins import from `core.ts`, `schema.ts`, and `trait-utils.ts`. Verify this is the case; if not, add missing exports to core's `index.ts`.

**Step 4: Fix import paths in plugin test files**

Replace:
- `import { mvfm } from "../../../../src/core"` → `import { mvfm } from "@mvfm/core"`
- `import { num } from "../../../../src/plugins/num"` → `import { num } from "@mvfm/core"`
- `import { postgres } from "../../../../src/plugins/postgres/3.4.8"` → `import { postgres } from "../../src/3.4.8"` (within same package)

**Step 5: Create `packages/plugin-P/package.json` for each**

Template (postgres example):
```json
{
  "name": "@mvfm/plugin-postgres",
  "version": "0.0.1",
  "description": "PostgreSQL plugin for mvfm",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "biome check src tests && tsc -p tsconfig.json && api-extractor run --local",
    "test": "vitest run",
    "size": "size-limit"
  },
  "files": ["dist", "etc"],
  "peerDependencies": {
    "@mvfm/core": "workspace:*"
  },
  "devDependencies": {
    "@mvfm/core": "workspace:*",
    "postgres": "^3.4.8"
  }
}
```

SDK dependencies go in `devDependencies` (they're peer deps at publish time, dev deps for building/testing). For plugins that use type-only imports from SDKs, `devDependencies` is sufficient.

Plugin-specific SDK deps:
- `plugin-anthropic`: `"@anthropic-ai/sdk": "^0.74.0"`
- `plugin-cloudflare-kv`: none (uses Workers types only)
- `plugin-fal`: `"@fal-ai/client": "^1.9.1"`
- `plugin-fetch`: none (native fetch)
- `plugin-openai`: `"openai": "^6.22.0"`
- `plugin-pino`: `"pino": "^10.3.1"`, `"@types/pino": "^7.0.4"`
- `plugin-postgres`: `"postgres": "^3.4.8"`, `"@testcontainers/postgresql": "^11.11.0"` (for round-trip tests)
- `plugin-redis`: `"ioredis": "^5.4.1"` (check actual import)
- `plugin-resend`: `"resend": "^4.0.0"` (check actual version)
- `plugin-s3`: `"@aws-sdk/client-s3": "^3.989.0"`
- `plugin-slack`: `"@slack/web-api": "^7.14.1"`
- `plugin-stripe`: `"stripe": "^20.3.1"`
- `plugin-twilio`: `"twilio": "^5.5.1"` (check actual version)

**Step 6: Create `packages/plugin-P/tsconfig.json` for each**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "composite": true,
    "paths": {
      "@mvfm/core": ["../core/src/index.ts"]
    }
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../core" }]
}
```

**Step 7: Create `packages/plugin-P/api-extractor.json` for each**

Same as root `api-extractor.json` template.

**Step 8: Create `packages/plugin-P/.size-limit.json` for each**

```json
[
  {
    "name": "@mvfm/plugin-P",
    "path": "dist/index.js",
    "limit": "1.5 kB"
  }
]
```

Set generous initial limits (1.5 kB); tighten after measuring baselines.

**Step 9: Commit**

```bash
git add -A && git commit -m "refactor: split external-service plugins into separate packages"
```

---

### Task 5: Clean up root and old directories

**Step 1: Remove old `src/` and `tests/` directories from root**

```bash
rm -rf src/ tests/
```

**Step 2: Remove old root config files that are now per-package**

- Remove root `api-extractor.json`
- Remove root `.size-limit.json`
- Remove root `tsconfig.json`

**Step 3: Create root `tsconfig.json` as project-references-only**

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/plugin-anthropic" },
    { "path": "packages/plugin-cloudflare-kv" },
    { "path": "packages/plugin-fal" },
    { "path": "packages/plugin-fetch" },
    { "path": "packages/plugin-openai" },
    { "path": "packages/plugin-pino" },
    { "path": "packages/plugin-postgres" },
    { "path": "packages/plugin-redis" },
    { "path": "packages/plugin-resend" },
    { "path": "packages/plugin-s3" },
    { "path": "packages/plugin-slack" },
    { "path": "packages/plugin-stripe" },
    { "path": "packages/plugin-twilio" }
  ]
}
```

**Step 4: Update `biome.json` to cover packages**

```json
{
  "files": {
    "includes": ["packages/*/src/**", "packages/*/tests/**"]
  }
}
```

(Keep all other biome settings the same.)

**Step 5: Remove old `dist/`, `etc/`, `temp/` directories**

```bash
rm -rf dist/ etc/ temp/
```

**Step 6: Update `.gitignore` if needed**

Ensure `node_modules/`, `dist/`, `temp/`, `*.tsbuildinfo` are ignored.

**Step 7: Commit**

```bash
git add -A && git commit -m "chore: clean up old root-level source and config files"
```

---

### Task 6: Install dependencies and fix build

**Step 1: Run `pnpm install`**

```bash
pnpm install
```

This should resolve workspace links and install all dependencies.

**Step 2: Build core first**

```bash
cd packages/core && pnpm run build
```

Fix any issues (likely none if paths are correct).

**Step 3: Build each plugin**

```bash
pnpm -r --filter './packages/plugin-*' run build
```

Fix import path issues — the most likely problem is plugins importing things from `core.ts` that aren't exported from `@mvfm/core`'s `index.ts`. If so, add missing exports to core's index.

**Step 4: Iterate until `pnpm run build` passes from root**

**Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve build issues across workspace packages"
```

---

### Task 7: Fix tests

**Step 1: Run core tests**

```bash
cd packages/core && pnpm run test
```

Fix any import path issues.

**Step 2: Run plugin tests**

```bash
pnpm -r --filter './packages/plugin-*' run test
```

Fix import path issues in test files.

**Step 3: Iterate until `pnpm run test` passes from root**

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve test issues across workspace packages"
```

---

### Task 8: Fix check (biome + tsc + api-extractor)

**Step 1: Run check from root**

```bash
pnpm run check
```

**Step 2: Fix biome issues**

Biome may flag formatting/lint issues from moved files. Run:

```bash
pnpm -r --filter './packages/*' exec biome check --write src tests
```

**Step 3: Fix api-extractor issues**

Each package needs to generate its own API report. Run api-extractor per package and commit the generated `etc/` files.

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: fix lint, formatting, and API reports"
```

---

### Task 9: Update CI workflow

**Step 1: Update `.github/workflows/ci.yml`**

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

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Check (lint + typecheck + api-extractor)
        run: pnpm run check

      - name: Test
        run: pnpm run test

  size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Check size budgets
        run: pnpm run size
```

Note: The `andresz1/size-limit-action` may not work well with workspaces. Simplify to just running `pnpm run size` for now. Can be re-added later if needed.

**Step 2: Commit**

```bash
git add -A && git commit -m "ci: update workflow for pnpm workspace"
```

---

### Task 10: Final verification

**Step 1: Run full verify**

```bash
pnpm run verify
```

This runs: build → check → test → size. All must pass.

**Step 2: Verify no stale `ilo` references**

```bash
grep -r "from.*ilo" packages/ --include="*.ts" | grep -v node_modules
```

Should return nothing.

**Step 3: Verify `pnpm-lock.yaml` exists and is committed**

**Step 4: Squash-fix any remaining issues and commit**

---

### Task 11: Create PR

```bash
gh pr create --title "refactor: monorepo packaging with pnpm workspace (#72)" --body "$(cat <<'EOF'
Closes #72

## What this does
Converts the single-package repo into a pnpm workspace monorepo. Foundational plugins (num, str, eq, etc.) stay in `@mvfm/core`. External-service plugins (postgres, stripe, openai, etc.) are split into independent `@mvfm/plugin-*` packages.

## Design alignment
- **Reduce install footprint**: Users install only the plugin packages they need
- **Unified development**: Single workspace with shared tooling
- **Single source of truth**: Architecture, tests, and release policy remain centralized

## Validation performed
- `pnpm run build` — all packages compile
- `pnpm run check` — biome lint + typecheck + api-extractor pass
- `pnpm run test` — all tests pass
- `pnpm run size` — size budgets pass
EOF
)"
```
