# Fal Plugin Type-Fidelity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Match `@mvfm/plugin-fal` API/runtime fidelity to `@fal-ai/client` for implemented methods (`run`, `subscribe`, `queue.submit/status/result/cancel`) with full tests.

**Architecture:** Replace broad plugin types with SDK-derived contracts, expand AST/effect payloads so implemented method options are preserved, and pass options through interpreter -> handler -> SDK adapter without silent drops. Keep scope limited to currently implemented surface and document explicit deviations when AST constraints require them.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `@fal-ai/client@1.9.1`, api-extractor.

---

### Task 1: Define SDK-aligned public types and method signatures

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/index.ts`
- Test: `packages/plugin-fal/tests/1.9.1/index.test.ts`

**Step 1: Write failing type-first/AST-surface tests**

Add tests that assert supported option fields are accepted and encoded for:
- `run`
- `subscribe`
- `queue.submit`
- `queue.status`
- `queue.result`
- `queue.cancel`

At minimum include representative fields beyond `input` (for example `method`, `startTimeout`, queue options) that currently get dropped.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-fal test -- tests/1.9.1/index.test.ts`
Expected: FAIL on missing AST fields or type mismatches.

**Step 3: Implement minimal public type/signature changes**

Update `index.ts` to:
- import SDK types (`EndpointType`, `InputType`, `OutputType`, `RunOptions`, `SubmitOptions`, `QueueStatusOptions`, `QueueSubscribeOptions`, `BaseQueueOptions`, `Result`, `QueueStatus`, `InQueueQueueStatus`)
- redefine exposed option types from SDK contracts
- tighten return types for implemented methods
- add overloads where needed for literal endpoint vs `Expr<string>` endpoint

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mvfm/plugin-fal test -- tests/1.9.1/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugin-fal/src/1.9.1/index.ts packages/plugin-fal/tests/1.9.1/index.test.ts
git commit -m "feat(plugin-fal): align public method types with fal sdk"
```

### Task 2: Carry full implemented-method options through AST and interpreter effects

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/index.ts`
- Modify: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Test: `packages/plugin-fal/tests/1.9.1/index.test.ts`
- Test: `packages/plugin-fal/tests/1.9.1/interpreter.test.ts`

**Step 1: Write failing interpreter tests for option passthrough**

Add tests ensuring effect payloads include full options for implemented methods (not just `input` / `requestId`).

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-fal test -- tests/1.9.1/interpreter.test.ts`
Expected: FAIL with missing option fields in captured effects.

**Step 3: Implement minimal AST/effect shape updates**

- Encode options objects in AST nodes for implemented methods.
- Update interpreter to recurse and yield options payloads in effects.
- Keep node kinds unchanged.

**Step 4: Run tests to verify passes**

Run:
- `pnpm --filter @mvfm/plugin-fal test -- tests/1.9.1/index.test.ts`
- `pnpm --filter @mvfm/plugin-fal test -- tests/1.9.1/interpreter.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugin-fal/src/1.9.1/index.ts packages/plugin-fal/src/1.9.1/interpreter.ts packages/plugin-fal/tests/1.9.1/index.test.ts packages/plugin-fal/tests/1.9.1/interpreter.test.ts
git commit -m "feat(plugin-fal): preserve sdk options in ast and effects"
```

### Task 3: Tighten adapter and server handler contracts to SDK parity

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/client-fal-sdk.ts`
- Modify: `packages/plugin-fal/src/1.9.1/handler.server.ts`
- Modify: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Test: `packages/plugin-fal/tests/1.9.1/interpreter.test.ts`
- Test: `packages/plugin-fal/tests/1.9.1/integration.test.ts` (create/update as needed)

**Step 1: Write failing runtime passthrough tests**

Add tests that verify:
- adapter receives and forwards supported options to `@fal-ai/client` calls
- server handler dispatch for each method uses typed options objects and returns typed shapes

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-fal test`
Expected: FAIL on mismatched handler/adapter invocation payloads.

**Step 3: Implement minimal runtime tightening**

- Update `FalClient` interface in interpreter to typed method signatures.
- Update `wrapFalSdk` forwarding calls with full options objects.
- Update `serverHandler` effect switching with typed payloads and no silent option dropping.

**Step 4: Run tests to verify passes**

Run: `pnpm --filter @mvfm/plugin-fal test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugin-fal/src/1.9.1/client-fal-sdk.ts packages/plugin-fal/src/1.9.1/handler.server.ts packages/plugin-fal/src/1.9.1/interpreter.ts packages/plugin-fal/tests/1.9.1/interpreter.test.ts packages/plugin-fal/tests/1.9.1/integration.test.ts
git commit -m "feat(plugin-fal): enforce sdk-typed handler and adapter contracts"
```

### Task 4: Document unavoidable deviations and regenerate API surface checks

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/index.ts`
- Modify: `packages/plugin-fal/etc/plugin-fal.api.md`
- Modify: `packages/plugin-fal/etc/plugin-fal.api.json`

**Step 1: Write failing API check**

Run API/lint checks first to capture delta.

**Step 2: Run check to verify failure/delta**

Run: `pnpm --filter @mvfm/plugin-fal check`
Expected: API extractor diffs until docs/types are aligned.

**Step 3: Implement minimal doc updates**

- Update TSDoc in `index.ts` to explicitly call out any unavoidable deviations from SDK fidelity for implemented methods.
- Regenerate API reports via `check` command.

**Step 4: Run check to verify passes**

Run: `pnpm --filter @mvfm/plugin-fal check`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugin-fal/src/1.9.1/index.ts packages/plugin-fal/etc/plugin-fal.api.md packages/plugin-fal/etc/plugin-fal.api.json
git commit -m "docs(plugin-fal): document sdk parity and explicit deviations"
```

### Task 5: Full verification gates

**Files:**
- Modify: none
- Test: whole workspace

**Step 1: Run full project verification**

Run:
- `npm run build`
- `npm run check`
- `npm test`

**Step 2: Validate results**

Expected: all commands pass with no regressions.

**Step 3: Commit final integration pass**

```bash
git add -A
git commit -m "test: verify fal sdk-fidelity changes across workspace"
```
