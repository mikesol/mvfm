# S3 Typed Command Shapes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace generic S3 plugin `Record<string, unknown>` method typing with command-specific `@aws-sdk/client-s3` method shapes while preserving runtime AST behavior.

**Architecture:** Keep runtime implementation unchanged and introduce type aliases inferred from `S3` aggregated client methods (`Parameters` + `Awaited<ReturnType>`). Apply aliases to `S3Methods` signatures and helper input typing. Add compile-time type tests in plugin tests to validate required inputs and result field typing.

**Tech Stack:** TypeScript 5.x, Vitest 4.x, pnpm workspace, `@aws-sdk/client-s3` v3.989.0.

---

### Task 1: Add Failing Type Assertions For S3 Signatures

**Files:**
- Modify: `packages/plugin-s3/tests/3.989.0/index.test.ts`

**Step 1: Write the failing test**

Add compile-time assertions that should fail against current `Record<string, unknown>` signatures:
- `$.s3.putObject({ Bucket: "b", Key: "k", Body: "x" })` returns `Expr<PutObjectOutput>` shape (assert property typing for `ETag`).
- `$.s3.getObject({ Bucket: "b", Key: "k" })` returns `Expr<GetObjectOutput>` shape (assert typed access to `ContentLength`).
- Optional negative assertion with `// @ts-expect-error` for missing required `Bucket` on one command.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-s3 run test -- tests/3.989.0/index.test.ts`
Expected: TypeScript/Vitest compile failure due missing specific types.

**Step 3: Commit**

```bash
git add packages/plugin-s3/tests/3.989.0/index.test.ts
git commit -m "test(plugin-s3): add failing type assertions for command shapes"
```

### Task 2: Implement SDK-Derived Input/Output Typing In S3 Plugin

**Files:**
- Modify: `packages/plugin-s3/src/3.989.0/index.ts`

**Step 1: Write minimal implementation**

- Import `S3` type from `@aws-sdk/client-s3`.
- Add local aliases for each implemented command:
  - input: `Parameters<S3["putObject"]>[0]`, etc.
  - output: `Awaited<ReturnType<S3["putObject"]>>`, etc.
- Replace `Expr<Record<string, unknown>> | Record<string, unknown>` with `Expr<CommandInput> | CommandInput`.
- Replace return types with `Expr<CommandOutput>`.
- Make `resolveInput` generic so each method preserves its input type.
- Keep generated AST node payloads and `nodeKinds` unchanged.

**Step 2: Run tests to verify it passes**

Run: `pnpm --filter @mvfm/plugin-s3 run test -- tests/3.989.0/index.test.ts`
Expected: PASS for AST tests and new type assertions.

**Step 3: Run package check**

Run: `pnpm --filter @mvfm/plugin-s3 run check`
Expected: PASS (biome + tsc + api-extractor local run).

**Step 4: Commit**

```bash
git add packages/plugin-s3/src/3.989.0/index.ts packages/plugin-s3/tests/3.989.0/index.test.ts
git commit -m "feat(plugin-s3): use aws sdk command-specific method types"
```

### Task 3: Verify No Behavioral Regression

**Files:**
- Modify (if needed): `packages/plugin-s3/tests/3.989.0/interpreter.test.ts`

**Step 1: Run interpreter/unit tests**

Run: `pnpm --filter @mvfm/plugin-s3 run test -- tests/3.989.0/interpreter.test.ts`
Expected: PASS, confirming unchanged runtime behavior.

**Step 2: If failures appear, apply minimal fixes**

Only adjust tests for purely type-level drift, not AST semantics.

**Step 3: Commit (if changed)**

```bash
git add packages/plugin-s3/tests/3.989.0/interpreter.test.ts
git commit -m "test(plugin-s3): align interpreter tests with typed signatures"
```

### Task 4: Final Verification Before PR

**Files:**
- Modify (if generated): `packages/plugin-s3/etc/plugin-s3.api.md`
- Modify (if generated): `packages/plugin-s3/etc/plugin-s3.api.json`

**Step 1: Run required project validation**

Run:
- `pnpm run build`
- `pnpm run check`
- `pnpm run test`

Expected: all pass, except environment-dependent integration suites (if Docker unavailable) documented with concrete failure output.

**Step 2: Stage outputs and summarize evidence**

Capture command status and failing-environment caveats (if any).

**Step 3: Commit final generated updates**

```bash
git add packages/plugin-s3/etc/plugin-s3.api.md packages/plugin-s3/etc/plugin-s3.api.json
git commit -m "chore(plugin-s3): refresh api report after typed command updates"
```
