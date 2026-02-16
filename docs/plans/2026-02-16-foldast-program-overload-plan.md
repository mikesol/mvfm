# foldAST Program Overload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `.ast.result` boilerplate by accepting `Program` directly in `foldAST`, and promote `injectInput` to a core export so no drilling is ever needed.

**Architecture:** Add overloads to `foldAST` and `checkCompleteness` that accept `Program`. Extract `injectInput` into a new `packages/core/src/inject.ts` module (fold.ts is at 288 lines — adding both overloads + injectInput would exceed 300). Update all test call sites.

**Tech Stack:** TypeScript, vitest

---

### Task 1: Create `inject.ts` with `injectInput`

**Files:**
- Create: `packages/core/src/inject.ts`
- Test: `packages/core/tests/inject.test.ts`

**Step 1: Write the failing test**

Create `packages/core/tests/inject.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mvfm } from "../src/core";
import { injectInput } from "../src/inject";

const app = mvfm();

describe("injectInput", () => {
  it("returns a Program with __inputData injected into core/input nodes", () => {
    const prog = app(($) => $.input("n").add(1));
    const injected = injectInput(prog, { n: 42 });

    // Returns a Program (has ast, hash, plugins, inputSchema)
    expect(injected).toHaveProperty("ast");
    expect(injected).toHaveProperty("hash", prog.hash);
    expect(injected).toHaveProperty("plugins");
    expect(injected).toHaveProperty("inputSchema");

    // Walk the AST to find core/input nodes and verify they have __inputData
    function findInputNodes(node: any): any[] {
      if (!node || typeof node !== "object") return [];
      if (Array.isArray(node)) return node.flatMap(findInputNodes);
      const found: any[] = [];
      if (node.kind === "core/input") found.push(node);
      for (const v of Object.values(node)) {
        found.push(...findInputNodes(v));
      }
      return found;
    }

    const inputNodes = findInputNodes(injected.ast);
    expect(inputNodes.length).toBeGreaterThan(0);
    for (const n of inputNodes) {
      expect(n.__inputData).toEqual({ n: 42 });
    }
  });

  it("does not mutate the original program", () => {
    const prog = app(($) => $.input("n"));
    const injected = injectInput(prog, { n: 10 });
    expect(injected).not.toBe(prog);
    expect(injected.ast).not.toBe(prog.ast);
  });

  it("preserves non-input nodes unchanged", () => {
    const prog = app((_$) => 42);
    const injected = injectInput(prog, { n: 1 });
    expect(injected.ast.result.kind).toBe("core/literal");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/inject.test.ts`
Expected: FAIL — `injectInput` does not exist yet.

**Step 3: Write minimal implementation**

Create `packages/core/src/inject.ts`:

```ts
import type { Program } from "./types";

/**
 * Inject input data into all `core/input` nodes in a Program.
 * Returns a new Program with the injected data — does not mutate the original.
 */
export function injectInput(program: Program, input: Record<string, unknown>): Program {
  function walk(node: any): any {
    if (node === null || node === undefined || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map((n) => walk(n));
    const result: any = {};
    for (const [k, v] of Object.entries(node)) {
      result[k] = walk(v);
    }
    if (result.kind === "core/input") result.__inputData = input;
    return result;
  }
  return { ...program, ast: walk(program.ast) };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run tests/inject.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/inject.ts packages/core/tests/inject.test.ts
git commit -m "feat(core): add injectInput as core export (#206)"
```

---

### Task 2: Add `Program` overload to `foldAST` and `checkCompleteness`

**Files:**
- Modify: `packages/core/src/fold.ts` (lines 80, 119)

**Step 1: Write the failing test**

Append to `packages/core/tests/inject.test.ts`:

```ts
import { foldAST, checkCompleteness } from "../src/fold";
import { coreInterpreter } from "../src/interpreters/core";
import { numInterpreter } from "../src/plugins/num/interpreter";
import { num } from "../src/plugins/num";
import { semiring } from "../src/plugins/semiring";

describe("foldAST with Program", () => {
  const app2 = mvfm(num, semiring);
  const combined = { ...coreInterpreter, ...numInterpreter };

  it("accepts a Program directly (no input)", async () => {
    const prog = app2((_$) => 42);
    const result = await foldAST(combined, prog);
    expect(result).toBe(42);
  });

  it("accepts an injected Program", async () => {
    const prog = app2(($) => $.input("n").add(1));
    const result = await foldAST(combined, injectInput(prog, { n: 9 }));
    expect(result).toBe(10);
  });
});

describe("checkCompleteness with Program", () => {
  it("accepts a Program directly", () => {
    const prog = mvfm()((_$) => 42);
    expect(() => checkCompleteness(coreInterpreter, prog)).not.toThrow();
  });

  it("throws for missing interpreters", () => {
    const prog = mvfm(num, semiring)(($) => $.input("n").add(1));
    expect(() => checkCompleteness({}, prog)).toThrow(/Missing interpreters/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run tests/inject.test.ts`
Expected: FAIL — `foldAST` does not accept `Program` yet.

**Step 3: Add Program overloads**

In `packages/core/src/fold.ts`:

1. Add import at top:
```ts
import type { Program } from "./types";
```

2. Replace `checkCompleteness` signature (line 80) with overloads:
```ts
/** Walk an AST to verify all node kinds have handlers. */
export function checkCompleteness(interpreter: Interpreter, program: Program): void;
export function checkCompleteness(interpreter: Interpreter, root: TypedNode): void;
export function checkCompleteness(interpreter: Interpreter, rootOrProgram: TypedNode | Program): void {
  const root = "ast" in rootOrProgram && "hash" in rootOrProgram
    ? (rootOrProgram as Program).ast.result
    : (rootOrProgram as TypedNode);
  // ... existing body unchanged (uses `root`)
```

3. Replace `foldAST` signature (line 119) with overloads:
```ts
/** Stack-safe async fold with memoization and taint tracking. */
export async function foldAST(interpreter: Interpreter, program: Program, state?: FoldState): Promise<unknown>;
export async function foldAST(interpreter: Interpreter, root: TypedNode, state?: FoldState): Promise<unknown>;
export async function foldAST(
  interpreter: Interpreter,
  rootOrProgram: TypedNode | Program,
  state?: FoldState,
): Promise<unknown> {
  const root = "ast" in rootOrProgram && "hash" in rootOrProgram
    ? (rootOrProgram as Program).ast.result
    : (rootOrProgram as TypedNode);
  // ... existing body unchanged (uses `root`)
```

**Step 4: Run test to verify it passes**

Run: `cd packages/core && npx vitest run tests/inject.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/fold.ts packages/core/tests/inject.test.ts
git commit -m "feat(core): add Program overloads for foldAST and checkCompleteness (#206)"
```

---

### Task 3: Export `injectInput` from barrel files

**Files:**
- Modify: `packages/core/src/core.ts` (barrel)
- Modify: `packages/core/src/index.ts` (public API)

**Step 1: Add to `packages/core/src/core.ts`**

Add this line after the existing exports:
```ts
export { injectInput } from "./inject";
```

**Step 2: Add to `packages/core/src/index.ts`**

Add after the `mvfm` export line:
```ts
export { injectInput } from "./inject";
```

**Step 3: Verify build**

Run: `cd packages/core && npm run build`
Expected: PASS — `injectInput` appears in generated `.d.ts` and API report.

**Step 4: Commit**

```bash
git add packages/core/src/core.ts packages/core/src/index.ts
git commit -m "feat(core): export injectInput from barrel files (#206)"
```

---

### Task 4: Update simple-pattern test files (20 files)

These 20 test files have a `run()` helper that does only `injectInput(prog.ast, input)` + `foldAST(combined, ast.result)`. Replace the local `injectInput` + `run()` with the core `injectInput` export.

**Files to modify:**
- `packages/core/tests/interpreters/core.test.ts`
- `packages/core/tests/plugins/error/interpreter.test.ts`
- `packages/core/tests/plugins/show/interpreter.test.ts`
- `packages/core/tests/plugins/str/interpreter.test.ts`
- `packages/core/tests/plugins/eq/interpreter.test.ts`
- `packages/core/tests/plugins/fiber/interpreter.test.ts`
- `packages/core/tests/plugins/heyting-algebra/interpreter.test.ts`
- `packages/core/tests/plugins/num/interpreter.test.ts`
- `packages/core/tests/plugins/ord/interpreter.test.ts`
- `packages/core/tests/plugins/semigroup/interpreter.test.ts`
- `packages/core/tests/plugins/semiring/interpreter.test.ts`
- `packages/plugin-zod/tests/array-interpreter.test.ts`
- `packages/plugin-zod/tests/bigint-interpreter.test.ts`
- `packages/plugin-zod/tests/coerce-interpreter.test.ts`
- `packages/plugin-zod/tests/date-interpreter.test.ts`
- `packages/plugin-zod/tests/enum-interpreter.test.ts`
- `packages/plugin-zod/tests/interpreter.test.ts`
- `packages/plugin-zod/tests/literal-interpreter.test.ts`
- `packages/plugin-zod/tests/object-interpreter.test.ts`
- `packages/plugin-zod/tests/string-formats-interpreter.test.ts`

**Pattern for each file:**

1. **Delete** the local `injectInput` function (the 9-line block)
2. **Add** `injectInput` to the import from `@mvfm/core` or the relative `../../src/fold` path (match the existing import style)
3. **Replace** the `run()` function body:

Before:
```ts
async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await foldAST(combined, ast.result);
}
```

After:
```ts
async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, input && Object.keys(input).length > 0 ? injectInput(prog, input) : prog);
}
```

Or simpler (since `injectInput` with empty input is harmless):
```ts
async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}
```

4. **Add** `Program` to the type import if not already present.

**Step: Run all tests**

Run: `cd packages/core && npx vitest run` and `cd packages/plugin-zod && npx vitest run`
Expected: All PASS

**Step: Commit**

```bash
git add -A
git commit -m "refactor(tests): use core injectInput in simple-pattern test files (#206)"
```

---

### Task 5: Update custom-pattern test files (13 plugin test files)

These files have a `run()` with mock client setup. Only the `injectInput` local function and the `injectInput(prog.ast, input)` + `.result` drill change. The mock client logic stays.

**Files:**
- `packages/plugin-redis/tests/5.4.1/interpreter.test.ts`
- `packages/plugin-twilio/tests/5.5.1/interpreter.test.ts`
- `packages/plugin-slack/tests/7.14.0/interpreter.test.ts`
- `packages/plugin-stripe/tests/2025-04-30.basil/interpreter.test.ts`
- `packages/plugin-resend/tests/6.9.2/interpreter.test.ts`
- `packages/plugin-s3/tests/3.989.0/interpreter.test.ts`
- `packages/plugin-pino/tests/10.3.1/interpreter.test.ts`
- `packages/plugin-openai/tests/6.21.0/interpreter.test.ts`
- `packages/plugin-fetch/tests/whatwg/interpreter.test.ts`
- `packages/plugin-fal/tests/1.9.1/interpreter.test.ts`
- `packages/plugin-console/tests/22.0.0/interpreter.test.ts`
- `packages/plugin-cloudflare-kv/tests/4.20260213.0/interpreter.test.ts`
- `packages/plugin-anthropic/tests/0.74.0/interpreter.test.ts`

**Pattern for each file:**

1. **Delete** the local `injectInput` function
2. **Add** `injectInput` to the import from `@mvfm/core` (these files import from `@mvfm/core`)
3. **Add** `type Program` to the type import from `@mvfm/core`
4. **In `run()`**: replace `const ast = injectInput(prog.ast, input);` + usages of `ast.result` with the Program-level equivalent

Before (typical):
```ts
async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: Array<...> = [];
  const ast = injectInput(prog.ast, input);
  const mockClient = { ... };
  const combined = { ...coreInterpreter, ...createFooInterpreter(mockClient) };
  const result = await foldAST(combined, ast.result);
  return { result, captured };
}
```

After:
```ts
async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: Array<...> = [];
  const injected = injectInput(prog, input);
  const mockClient = { ... };
  const combined = { ...coreInterpreter, ...createFooInterpreter(mockClient) };
  const result = await foldAST(combined, injected);
  return { result, captured };
}
```

**Step: Run all plugin tests**

Run: `npm test` (from repo root)
Expected: All PASS

**Step: Commit**

```bash
git add -A
git commit -m "refactor(tests): use core injectInput in custom-pattern plugin test files (#206)"
```

---

### Task 6: Update dag-memoization and scoped-recurse tests

**Files:**
- `packages/core/tests/interpreters/dag-memoization.test.ts` — uses custom tracking interpreter + `createFoldState`, calls `foldAST` directly with raw `TypedNode`. **No changes needed** (operates on raw nodes).
- `packages/core/tests/interpreters/scoped-recurse.test.ts` — calls `foldAST` directly with raw `TypedNode`. **No changes needed**.
- `packages/core/tests/interpreters/async-engine.test.ts` — calls `foldAST` directly with inline `TypedNode`. **No changes needed**.

**Step 1: Verify these tests still pass**

Run: `cd packages/core && npx vitest run tests/interpreters/`
Expected: All PASS

**Step 2: No commit needed** (no changes)

---

### Task 7: Update integration test files

Check if any integration test files (`integration.test.ts`) also have the `injectInput` pattern and update them.

**Files to check (from earlier grep):**
- `packages/plugin-postgres/tests/integration/async-composition.test.ts`
- `packages/plugin-postgres/tests/integration/dag-memoization-integration.test.ts`
- `packages/plugin-twilio/tests/5.5.1/integration.test.ts`
- `packages/plugin-slack/tests/7.14.0/integration.test.ts`
- `packages/plugin-stripe/tests/2025-04-30.basil/integration.test.ts`
- `packages/plugin-resend/tests/6.9.2/integration.test.ts`
- `packages/plugin-s3/tests/3.989.0/integration.test.ts`
- `packages/plugin-pino/tests/10.3.1/integration.test.ts`
- `packages/plugin-openai/tests/6.21.0/integration.test.ts`
- `packages/plugin-fetch/tests/whatwg/integration.test.ts`
- `packages/plugin-fal/tests/1.9.1/integration.test.ts`
- `packages/plugin-console/tests/22.0.0/integration.test.ts`

**Same pattern as Task 5:** Delete local `injectInput`, import from `@mvfm/core`, update `run()` to use `Program`-level `injectInput`.

**Step: Run all tests**

Run: `npm test` (from repo root)
Expected: All PASS

**Step: Commit**

```bash
git add -A
git commit -m "refactor(tests): use core injectInput in integration test files (#206)"
```

---

### Task 8: Regenerate API report and update docs

**Files:**
- Regenerate: `packages/core/etc/core.api.md`
- Regenerate: `packages/core/etc/core.api.json`
- Modify: `docs/plugin-authoring-guide.md` (if it references `injectInput` or `foldAST` with `.ast.result` drilling)

**Step 1: Rebuild**

Run: `cd packages/core && npm run build`
Expected: PASS — API report regenerated with new overloads and `injectInput` export.

**Step 2: Check plugin-authoring-guide.md**

If it shows the old `foldAST(interp, prog.ast.result)` pattern, update to `foldAST(interp, prog)`.

**Step 3: Run full validation**

Run: `npm run build && npm run check && npm test`
Expected: All PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: regenerate API report for foldAST Program overload (#206)"
```

---

### Task 9: Final validation

**Step 1: Full build + check + test**

Run: `npm run build && npm run check && npm test`
Expected: All PASS

**Step 2: Review diff**

Run: `git diff main --stat`
Verify: No unexpected files changed.
