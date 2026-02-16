# Lambda Scope Spikes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and compare three lexical-scope lambda evaluation spikes (`recurse_scoped` effect, `core/apply_lambda` node, and environment-aware interpreter contract) to choose the cleanest correct architecture.

**Architecture:** All spikes use lexical param identity (`core/lambda_param.__id`) and avoid AST mutation for lambda application. Each spike is implemented behind an explicit runtime variant so behavior is directly comparable from the same AST programs. Comparison is based on correctness (shadowing, reentrancy, memo/taint behavior), plugin impact, and DX ergonomics.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, mvfm core fold/interpreter architecture.

---

### Task 1: Add cross-cutting lexical-scope regression tests (red)

**Files:**
- Modify: `packages/core/tests/interpreters/dag-memoization.test.ts`
- Create: `packages/core/tests/interpreters/lambda-scope-spikes.test.ts`

**Step 1: Write failing tests for lexical correctness invariants**

```ts
it("does not capture nested lambda with same param name", async () => {
  // outer param name == inner param name, but node identity differs
  // expected: inner lambda resolves its own binding only
});

it("re-evaluates lambda params across invocations without clone", async () => {
  // same lambda body invoked with different values in one run
});

it("preserves memoization for stable DAG children under lambda application", async () => {
  // stable subnode should cache; param-dependent nodes should taint
});
```

**Step 2: Run targeted tests to verify they fail**

Run: `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes.test.ts`
Expected: FAIL (missing runtime support for lexical param scope)

**Step 3: Commit test-only scaffold**

```bash
git add packages/core/tests/interpreters/lambda-scope-spikes.test.ts packages/core/tests/interpreters/dag-memoization.test.ts
git commit -m "test(core): add lexical scope regression tests for lambda evaluation (#195)"
```

### Task 2: Spike A - scoped recurse effect (`recurse_scoped`)

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/interpreters/core.ts`
- Modify: `packages/core/src/plugins/error/interpreter.ts`
- Modify: `packages/core/src/plugins/fiber/interpreter.ts`
- Modify: `packages/plugin-zod/src/interpreter.ts`
- Test: `packages/core/tests/interpreters/lambda-scope-spikes.test.ts`

**Step 1: Introduce scoped evaluation effect in fold**

```ts
type ScopedBinding = { paramId: number; value: unknown };
// child yield variant from handlers:
// { type: "recurse_scoped", child, bindings }
```

Add evaluator support that pushes bindings for child evaluation only, then pops on completion/error.

**Step 2: Resolve `core/lambda_param` from fold scope before `__value` fallback**

- Provide a scope lookup helper keyed by `node.__id`.
- Throw explicit error for unbound lambda param in scoped mode.

**Step 3: Replace clone+inject callsites in fiber/error/zod with scoped recurse**

```ts
yield { type: "recurse_scoped", child: lambda.body, bindings: [{ paramId: lambda.param.__id, value }] }
```

**Step 4: Run targeted tests**

Run: `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes.test.ts`
Expected: PASS for Spike A mode

**Step 5: Commit Spike A**

```bash
git add packages/core/src/fold.ts packages/core/src/interpreters/core.ts packages/core/src/plugins/error/interpreter.ts packages/core/src/plugins/fiber/interpreter.ts packages/plugin-zod/src/interpreter.ts packages/core/tests/interpreters/lambda-scope-spikes.test.ts
git commit -m "spike(core): add recurse_scoped lexical lambda evaluation (#195)"
```

### Task 3: Spike B - explicit `core/apply_lambda` node

**Files:**
- Modify: `packages/core/src/interpreters/core.ts`
- Modify: `packages/core/src/plugins/error/interpreter.ts`
- Modify: `packages/core/src/plugins/fiber/interpreter.ts`
- Modify: `packages/plugin-zod/src/interpreter.ts`
- Modify: `packages/core/src/plugins/*/index.ts` (only if builder helper is required)
- Test: `packages/core/tests/interpreters/lambda-scope-spikes.test.ts`

**Step 1: Add typed node + core interpreter handler**

```ts
interface CoreApplyLambda extends TypedNode<unknown> {
  kind: "core/apply_lambda";
  param: { kind: "core/lambda_param"; __id: number };
  body: TypedNode;
  arg: TypedNode;
}
```

Handler semantics:
1. evaluate `arg`
2. evaluate `body` under lexical binding for `param.__id`

**Step 2: Rewrite lambda application callsites to build/evaluate `core/apply_lambda`**

- Keep existing plugin APIs unchanged.
- Translate prior clone+inject helpers to node construction.

**Step 3: Run targeted tests**

Run: `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes.test.ts`
Expected: PASS for Spike B mode

**Step 4: Commit Spike B**

```bash
git add packages/core/src/interpreters/core.ts packages/core/src/plugins/error/interpreter.ts packages/core/src/plugins/fiber/interpreter.ts packages/plugin-zod/src/interpreter.ts packages/core/tests/interpreters/lambda-scope-spikes.test.ts
git commit -m "spike(core): model lambda application via core/apply_lambda node (#195)"
```

### Task 4: Spike C - environment-aware interpreter contract

**Files:**
- Modify: `packages/core/src/fold.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/interpreters/core.ts`
- Modify: `packages/core/src/plugins/error/interpreter.ts`
- Modify: `packages/core/src/plugins/fiber/interpreter.ts`
- Modify: `packages/plugin-zod/src/interpreter.ts`
- Test: `packages/core/tests/interpreters/lambda-scope-spikes.test.ts`

**Step 1: Add alternative interpreter type with explicit env/context**

```ts
type EvalEnv = ReadonlyMap<number, unknown>;
type EnvHandler = (node: TypedNode, env: EvalEnv) => AsyncGenerator<...>;
```

Implement separate fold entrypoint (`foldASTWithEnv`) so baseline API remains intact.

**Step 2: Update core lambda_param and selected plugins to env-aware calls**

- `core/lambda_param` reads from env by `__id`.
- Lambda application extends env in evaluator-managed child evaluation.

**Step 3: Run targeted tests**

Run: `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes.test.ts`
Expected: PASS for Spike C mode

**Step 4: Commit Spike C**

```bash
git add packages/core/src/fold.ts packages/core/src/index.ts packages/core/src/interpreters/core.ts packages/core/src/plugins/error/interpreter.ts packages/core/src/plugins/fiber/interpreter.ts packages/plugin-zod/src/interpreter.ts packages/core/tests/interpreters/lambda-scope-spikes.test.ts
git commit -m "spike(core): evaluate env-aware interpreter contract for lexical lambda scope (#195)"
```

### Task 5: Benchmark and compare the three spikes

**Files:**
- Create: `packages/core/tests/interpreters/lambda-scope-spikes.bench.test.ts`
- Modify: `docs/plans/2026-02-16-lambda-scope-spikes-design.md` (comparison section)

**Step 1: Add benchmark-like deterministic comparison tests**

Measure per-mode:
- invocation correctness under nested-shadowing
- allocation proxy metric (clone count via instrumentation)
- stable DAG cache hit behavior

**Step 2: Run comparison tests**

Run: `pnpm --filter @mvfm/core test -- tests/interpreters/lambda-scope-spikes*.test.ts`
Expected: PASS with per-mode metrics logged

**Step 3: Record recommendation with evidence**

Write concise table: semantic clarity, plugin churn, DX churn, performance profile.

**Step 4: Commit comparison artifact**

```bash
git add packages/core/tests/interpreters/lambda-scope-spikes.bench.test.ts docs/plans/2026-02-16-lambda-scope-spikes-design.md
git commit -m "docs(core): compare lexical lambda scope spike variants (#195)"
```

### Task 6: Full verification before sharing recommendation

**Files:**
- No file changes required.

**Step 1: Run required verification suite**

Run: `pnpm run build && pnpm run check && pnpm test`
Expected: PASS across workspace

**Step 2: Capture exact results in issue-ready summary**

Include:
- passed/failed suites
- any expected spike-only deviations
- final recommended direction

