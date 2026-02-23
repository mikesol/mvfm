# Design: Adopt core Liftable<T> + shapes + resolveStructured() across all plugins

**Issue:** #317
**Date:** 2026-02-23

## Problem

Every plugin (except openai and zod) independently copies a `liftArg` function and registers its own `plugin/record` + `plugin/array` kinds. ~55 copies of identical code. The core now provides `Liftable<T>`, `shapes`, and `resolveStructured()` to eliminate this boilerplate.

## Approach

Mechanical migration following the openai reference implementation. Each plugin is independent — migrate in parallel batches, validate each with `npm run build && npm run check && npm test`.

## Migration pattern (per plugin)

**Delete:** `liftArg()`, `plugin/record` + `plugin/array` kinds, their interpreter handlers, `liftArg()` calls in constructors.

**Add:** `shapes` field on plugin object, `Liftable<T>` on constructor params, `resolveStructured()` in interpreter handlers.

**Reference:** `packages/plugin-openai/src/6.21.0/index.ts` and `interpreter.ts`.

## Plugin groupings by complexity

### Tier 1: Standard pattern (simple mechanical migration)
- **anthropic** — Rich SDK types available
- **resend** — Rich SDK types available
- **s3** — Rich SDK types available (`@aws-sdk/client-s3`)
- **stripe** — Rich SDK types available
- **fetch** — Uses WHATWG `RequestInit`; mixed args `[null, "*"]` for url+init
- **fal** — Thin SDK types
- **twilio** — Limited SDK types, use `Record<string, unknown>` fallback
- **cloudflare-kv** — Platform types, partial

### Tier 2: Structural quirks
- **pino** — Variadic merge objects in log methods
- **console** — Uses `core/record` and `core/tuple` instead of namespaced kinds; has `liftConsoleArg`
- **redis** — `liftArg` in `build-methods.ts`, only `hset`/`hmset` take objects
- **postgres** — `liftArg` in `build-methods.ts`, only `insert()`/`set()` helpers; SQL template literals must NOT get shapes

### Tier 3: Special handling
- **slack** — Codegen script (`scripts/codegen.ts`) emits `liftArg` into 33 `build-methods-*.ts` files. Update the codegen template, then regenerate.
- **zod** — Does not use `liftArg`; uses manual `isCExpr()` walks in `extract-cexprs.ts`. Evaluate if `shapes` can replace this; if not, skip or minimal changes.

## Key decisions

1. **Slack codegen:** Modify the template in `codegen.ts` to stop emitting `liftArg`, add `shapes` to the plugin object, and use `resolveStructured()` in generated interpreters. Then regenerate all files.

2. **Zod:** Evaluate only — if `shapes` can replace `extract-cexprs.ts` manual walks, do it. If the pattern is fundamentally different, document why and skip.

3. **Type precision:** Plugins with rich SDK types get `Liftable<SdkType>` and typed `KindSpec`. Plugins without get `Liftable<Record<string, unknown>>` or keep `unknown`.

4. **Execution:** Parallel sub-agents, one per plugin (or small batches). Each validates independently with build+check+test.

## Validation

Each plugin migration must pass: `npm run build && npm run check && npm test`.
