# Console Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@mvfm/plugin-console` with full Node `console` API coverage and complete test coverage for AST, interpreter, and integration behavior.

**Architecture:** Create a new plugin package mirroring existing external plugin structure (`plugin-pino`), with versioned source (`22.0.0`), explicit per-method node kinds, a generator interpreter yielding `console/*` effects, server/client handlers, and a runtime adapter around console-like instances.

**Tech Stack:** TypeScript, MVFM core plugin APIs, Vitest, Biome, API Extractor, pnpm workspaces.

---

### Task 1: Scaffold `@mvfm/plugin-console` package

**Files:**
- Create: `packages/plugin-console/package.json`
- Create: `packages/plugin-console/tsconfig.json`
- Create: `packages/plugin-console/api-extractor.json`
- Create: `packages/plugin-console/src/index.ts`

**Step 1: Add package metadata and scripts**
- Model after `packages/plugin-pino/package.json`.
- Set name to `@mvfm/plugin-console`.

**Step 2: Add TypeScript and API extractor configs**
- Reuse same compiler/api-extractor patterns as existing plugin packages.

**Step 3: Add top-level exports file**
- Re-export versioned module exports from `src/22.0.0` paths.

**Step 4: Validate package is discoverable**
Run: `pnpm --filter @mvfm/plugin-console run build`
Expected: package target found (may fail until implementation files exist).

### Task 2: Write failing AST tests first (TDD RED)

**Files:**
- Create: `packages/plugin-console/tests/22.0.0/index.test.ts`

**Step 1: Write AST tests for all console methods**
- One test table to iterate all method names and expected node kinds.
- Add dedicated tests for special signatures: `assert`, `dir`, `count/time labels`, zero-arg methods.

**Step 2: Run AST test to verify failure**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/index.test.ts`
Expected: FAIL (plugin not implemented).

### Task 3: Implement builder API and types (TDD GREEN)

**Files:**
- Create: `packages/plugin-console/src/22.0.0/index.ts`

**Step 1: Define exported public types with TSDoc**
- `ConsoleConfig`, `ConsoleMethods`, `ConsoleApi` and any helper types.

**Step 2: Implement plugin factory**
- `consolePlugin(config?): PluginDefinition<ConsoleMethods>`.
- Exhaustive `nodeKinds` with `console/<method>` names.
- `build(ctx)` returns `$.console` object with all methods.

**Step 3: Re-run AST tests**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/index.test.ts`
Expected: PASS.

### Task 4: Write failing interpreter tests (TDD RED)

**Files:**
- Create: `packages/plugin-console/tests/22.0.0/interpreter.test.ts`

**Step 1: Add interpreter behavior tests**
- Verify each method yields correct effect type/payload.
- Verify recursive resolution of expression arguments.

**Step 2: Run interpreter tests to verify failure**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/interpreter.test.ts`
Expected: FAIL (interpreter not implemented).

### Task 5: Implement interpreter and handlers (TDD GREEN)

**Files:**
- Create: `packages/plugin-console/src/22.0.0/interpreter.ts`
- Create: `packages/plugin-console/src/22.0.0/handler.server.ts`
- Create: `packages/plugin-console/src/22.0.0/handler.client.ts`

**Step 1: Implement generator interpreter fragment**
- Namespace: `console`.
- Resolve `ASTNode[]` args with recurse and yield `console/<method>` effects.

**Step 2: Implement server handler**
- Dispatch `console/*` effects to client adapter.

**Step 3: Implement client handler**
- Mirror existing remote-step handler shape from other plugins.

**Step 4: Re-run interpreter tests**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/interpreter.test.ts`
Expected: PASS.

### Task 6: Write failing integration tests (TDD RED)

**Files:**
- Create: `packages/plugin-console/tests/22.0.0/integration.test.ts`

**Step 1: Add integration tests with capturing console double**
- Verify end-to-end invocation for all methods and argument forwarding.

**Step 2: Run integration tests to verify failure**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/integration.test.ts`
Expected: FAIL (runtime adapter not implemented).

### Task 7: Implement console client adapter (TDD GREEN)

**Files:**
- Create: `packages/plugin-console/src/22.0.0/client-console.ts`
- Modify: `packages/plugin-console/src/index.ts`

**Step 1: Implement adapter over console-like instance**
- Define `ConsoleInstance` and `ConsoleClient` interfaces.
- Implement `wrapConsole(instance)`.

**Step 2: Export adapter from top-level index**
- Ensure all public exports include TSDoc in source files.

**Step 3: Re-run integration tests**
Run: `pnpm --filter @mvfm/plugin-console run test -- tests/22.0.0/integration.test.ts`
Expected: PASS.

### Task 8: Full package verification + polish

**Files:**
- Modify as needed for lint/type/doc extraction results.

**Step 1: Run package build/check/test**
Run: `pnpm --filter @mvfm/plugin-console run build`
Run: `pnpm --filter @mvfm/plugin-console run check`
Run: `pnpm --filter @mvfm/plugin-console run test`
Expected: all PASS.

**Step 2: Run required project-level verification commands (document known baseline failures separately)**
Run: `pnpm run build`
Run: `pnpm run check`
Run: `pnpm run test`
Expected: may include known unrelated baseline failures; capture exact evidence.

**Step 3: Commit**
```bash
git add packages/plugin-console docs/plans/2026-02-15-console-plugin-design.md docs/plans/2026-02-15-console-plugin-implementation-plan.md
git commit -m "feat: add full-coverage console plugin"
```
