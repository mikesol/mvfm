# Issue 233 Branded Interpreter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace untyped interpreter/program flow with branded phantom-typed `Interpreter<K>` + `Program<K>` and enforce factory-only interpreter construction.

**Architecture:** Centralize type-system changes in `@mvfm/core` (`fold.ts`, `types.ts`, `core.ts`, `defaults.ts`, `builder.ts`) and then migrate plugin/interpreter callsites to new factories (`definePlugin`, `defineInterpreter`, `mergeInterpreters`). Keep runtime behavior unchanged.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Biome, API Extractor.

---

### Task 1: Core type surface replacement

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/core.ts`
- Modify: `packages/core/src/index.ts`

1. Add branded `Interpreter<K>` machinery and `defineInterpreter<K>()`.
2. Add `mergeInterpreters(a, b)` factory.
3. Convert `foldAST` signature to require branded `Interpreter<K>` + `Program<K>`.
4. Remove `typedInterpreter`, `typedFoldAST`, `CompleteInterpreter`, and untyped `Interpreter` export path.

### Task 2: Program/plugin/app phantom kind propagation

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/builder.ts`
- Modify: `packages/core/src/defaults.ts`

1. Convert `Program` to `Program<K>`.
2. Add `definePlugin(...)` factory and migrate plugin definition typing to `PluginDefinition<K>`.
3. Update `mvfm()` kind inference and `defaults()` return type to branded `Interpreter<K>`.
4. Ensure defaults merge path uses one trusted branded cast only.

### Task 3: RED migration fixups across core/plugins

**Files:**
- Modify all compile-failing plugin/interpreter definitions now using raw objects or `typedInterpreter`.
- Modify tests/callsites requiring updated signatures.

1. Replace plugin object literals with `definePlugin(...)` where required.
2. Replace raw spread interpreter composition with `mergeInterpreters(...)`.
3. Ensure no extra trusted cast points are introduced.

### Task 4: Type tests for branding/any rejection

**Files:**
- Modify: `packages/core/src/__tests__/*.type-test.ts` (and plugin type tests as needed)

1. Add/adjust tests for:
   - brand blocks annotation construction
   - `node:any` rejected in `defineInterpreter` and `definePlugin`
   - wrong node type rejected
   - missing kind rejected
   - unregistered kind rejected
   - unbranded object rejected by `foldAST`
2. Remove tests tied to deleted APIs.

### Task 5: Full verification and STOP-condition audit

**Files:**
- Review all touched files for cast points and old symbol removals

1. Verify exactly four `as unknown as Interpreter<K>` trusted casts remain.
2. Verify old APIs are absent.
3. Run:
   - `npm run build`
   - `npm run check`
   - `npm test`
4. If any STOP condition triggers, halt and report without workaround.
