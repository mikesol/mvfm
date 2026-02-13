# Bundle Size Budgets & Tracking — Design

**Issue:** #42
**Date:** 2026-02-13
**Status:** Approved

## Tool Choice

[size-limit](https://github.com/ai/size-limit) with `@size-limit/preset-small-lib`. Uses esbuild internally for bundling and tree-shaking measurement. This is the standard tool for library size budgeting — maintained by Evil Martians, used by major open-source projects.

### Dev Dependencies

- `size-limit`
- `@size-limit/preset-small-lib` (pulls in `@size-limit/esbuild` and `@size-limit/file`)

## Configuration

`.size-limit.json` at project root with 5 entries representing layered realistic usage:

| Entry | Import | Purpose |
|---|---|---|
| Minimal pure-logic | `{ num, eq }` | Smallest realistic usage — verifies tree-shaking isolates pure-logic plugins |
| Medium with control flow | `{ num, str, eq, boolean, control }` | Typical prelude-heavy app — verifies linear scaling |
| External service (postgres) | `{ postgres, postgresInterpreter }` | Largest single plugin — verifies isolation from prelude code |
| External service (stripe) | `{ stripe, stripeInterpreter }` | Second external service — same isolation test |
| Full import | `*` | Worst case ceiling for the entire library |

Each entry specifies `path` (dist/index.js), `import` (named imports), and `limit` (the budget).

## Budget Strategy

1. Run size-limit once to measure the initial baseline
2. Set limits at ~120% of measured values (headroom for normal development)
3. Budgets live in `.size-limit.json` — changes are visible in PR diffs

**Escape hatch:** Update the limit in `.size-limit.json` with a commit message explaining why. No mechanism to disable the check entirely.

## CI Integration

### Local

`npm run size` script in `package.json` runs `size-limit`. Developers check before pushing.

### GitHub Actions

New job in `.github/workflows/ci.yml` using [`andresz1/size-limit-action`](https://github.com/andresz1/size-limit-action):

- Runs on every PR
- Posts a comment with before/after size table and deltas
- Fails the check if any budget is exceeded

## Tree-Shaking Prerequisite

Before budgets are meaningful:

1. Add `"sideEffects": false` to `package.json` — signals to bundlers that all modules are safe to tree-shake
2. Verify by comparing "minimal pure-logic" entry to "full import" — if sizes are similar, tree-shaking is broken and must be fixed first

## Not in Scope

- Runtime performance benchmarking
- Lazy-loading or code-splitting strategies
- Subpath exports (may be surfaced as a follow-up if tree-shaking proves insufficient)
