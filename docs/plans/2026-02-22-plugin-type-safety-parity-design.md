# Plugin Type Safety Parity — Design Document

**Issue:** #299
**Date:** 2026-02-22
**Status:** Approved

## Problem

The plugin system has two parallel mechanisms for declaring node kinds:

1. `kinds: Record<string, KindSpec>` — carries full type information. Used by elaboration.
2. `nodeKinds: readonly string[]` — flat list with zero type info. Used by `defaults()`.

Only std plugins (num, str, bool) populate `kinds`. All other plugins have `kinds: {}` or `KindSpec<unknown[], unknown>` stubs and rely on `nodeKinds`. This means external plugins are completely untyped in the elaboration pipeline, and the two fields duplicate information.

## Goal

Type safety parity with core for every plugin. The test suite is the specification.

## Approach: Test-first, work backwards

Replicate the proof categories from core's test suite across all plugins, then make them pass.

### Test category 1: Type safety ("wrong types fail at compile time")

Every plugin gets a type-safety test with two assertion categories:

**A) Construction-time errors.** `app()` rejects wrong types in the DSL via `@ts-expect-error`.

**B) Dirty-manipulation errors.** `swapEntry`/`rewireChildren` with incompatible output types produce `SwapTypeError`/`RewireTypeError`, not `DirtyExpr`. Same pattern as `dirty-type-safety.test.ts`.

For each plugin, pick 2-3 kinds with distinct output types and prove the type system distinguishes them.

### Test category 2: End-to-end ("everything works")

Every plugin gets an integration test exercising a representative subset of kinds through `mvfm → app → fold(defaults)` with real infrastructure:

| Plugin group | Infrastructure |
|---|---|
| postgres, redis | testcontainer |
| s3, cloudflare-kv | localstack / mock |
| fetch | mock server |
| console, pino | capture / spy |
| slack, twilio, resend | fixture-backed / mocks |
| openai, anthropic, fal, stripe | fixture-backed |
| zod | pure (no infra) |

Representative subset (3-5 kinds) is sufficient for generated plugins.

### No dagql-fu tests for plugins

If type safety is proven at both construction and dirty-manipulation layers, graph queries/transforms inherit correctness from core.

## Mechanism: Eliminate `nodeKinds`

Zero duplication. Single source of truth is `kinds: Record<string, KindSpec>`.

### Core changes

1. Remove `nodeKinds` from `Plugin` interface (`packages/core/src/plugin.ts:68`)
2. Update `defaults()` — replace `plugin.nodeKinds.length === 0` with `Object.keys(plugin.kinds).length === 0`
3. Update `scripts/check-docs-coverage.ts` — iterate `Object.keys(plugin.kinds)`
4. Update `compat.ts:57` — `definePlugin` signature

### Input typing strategy

Full input types everywhere, including variadic kinds:

- Fixed arity: `KindSpec<[Response], number>` for `fetch/status`
- Variadic: `KindSpec<[number, ...string[], ...unknown[]], unknown[]>` for `postgres/query`
- Generated plugins: types from underlying SDK types (`@slack/web-api`, `ioredis`, etc.)

## Work order

### Phase 1: Core break (gates everything)

- Remove `nodeKinds` from `Plugin` interface
- Update `defaults()`, `check-docs-coverage.ts`, `compat.ts`
- Delete `nodeKinds` from num, str, bool, ord (already have full `kinds`)

### Phase 2: Internal plugins (st, control, error, fiber)

- Write real `KindSpec` entries for each kind
- Write type-safety tests (construction + dirty)
- Delete `nodeKinds`

### Phase 3: External plugins — mock-based (fetch, console, pino, zod)

- Add full `KindSpec` types, remove `nodeKinds`
- Write type-safety + end-to-end tests

### Phase 4: External plugins — fixture-based (slack, openai, anthropic, fal, stripe, twilio, resend)

- Update generators where applicable (slack)
- Add full `KindSpec` types, remove `nodeKinds`
- Write type-safety + end-to-end tests

### Phase 5: External plugins — container-based (postgres, redis, s3, cloudflare-kv)

- Add full `KindSpec` types, remove `nodeKinds`
- Write type-safety + end-to-end tests

### Phase 6: Cleanup

- Verify `npm run build && npm run check && npm test`
- Verify zero `nodeKinds` references remain
- Update `docs/plugin-authoring-guide.md`

Phases 3, 4, 5 are independent and parallelizable. Phases 1-2 are sequential and gate everything.

## Reference tests

- `packages/core/tests/everything-everywhere-all-at-once.test.ts`
- `packages/core/tests/dirty-type-safety.test.ts`
- `packages/core/tests/dagql-fu-mutations.test.ts` + `dagql-fu-predicates.test.ts` (core only)
