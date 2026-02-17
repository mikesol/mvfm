# st Interpreter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interpreter for the `st` plugin so programs using mutable state can be executed with `foldAST`.

**Architecture:** Closure-based factory `createStInterpreter()` creates an interpreter with a private `Map<string, unknown>` store. `st/get` is registered as volatile so it's never cached. The plugin definition gets `defaultInterpreter` so `defaults()` works automatically.

**Tech Stack:** TypeScript, vitest, `defineInterpreter` from `@mvfm/core`

---

### Task 1: Add `st/get` to VOLATILE_KINDS

**Files:**
- Modify: `packages/core/src/fold.ts:138`

**Step 1: Add `st/get` to the volatile set**

In `packages/core/src/fold.ts` line 138, change:

```typescript
export const VOLATILE_KINDS = new Set<string>(["core/lambda_param", "postgres/cursor_batch"]);
```

to:

```typescript
export const VOLATILE_KINDS = new Set<string>(["core/lambda_param", "postgres/cursor_batch", "st/get"]);
```

**Step 2: Verify build still passes**

Run: `npm run build -w packages/core`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/core/src/fold.ts
git commit -m "feat(st): mark st/get as volatile kind"
```

---

### Task 2: Write failing tests for the st interpreter

**Files:**
- Create: `packages/core/tests/plugins/st/interpreter.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { defaults } from "../../../src/defaults";
import type { TypedNode } from "../../../src/fold";
import { foldAST } from "../../../src/fold";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";
import { st } from "../../../src/plugins/st";
import { createStInterpreter } from "../../../src/plugins/st/interpreter";

describe("st interpreter", () => {
  it("provides defaultInterpreter so defaults(app) works without override", () => {
    const app = mvfm(num, semiring, st);
    expect(() => defaults(app)).not.toThrow();
  });

  it("st/let + st/get returns the initial value", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [{ kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 42 } }],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toBe(42);
  });

  it("st/set + st/get returns the updated value", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 1 } },
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: 99 } },
      ],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toBe(99);
  });

  it("st/push appends to an array variable", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: [1] } },
        { kind: "st/push", ref: "st_0", value: { kind: "core/literal", value: 2 } },
      ],
      result: { kind: "st/get", ref: "st_0" },
    };
    await expect(foldAST(combined, node)).resolves.toEqual([1, 2]);
  });

  it("st/get on undefined ref throws", async () => {
    const combined = { ...coreInterpreter, ...createStInterpreter() };
    const node: TypedNode = { kind: "st/get", ref: "st_nonexistent" };
    await expect(foldAST(combined, node)).rejects.toThrow("st/get: unknown ref");
  });

  it("multiple variables are independent", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: "a" } },
        { kind: "st/let", ref: "st_1", initial: { kind: "core/literal", value: "b" } },
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: "x" } },
      ],
      result: {
        kind: "core/tuple",
        elements: [
          { kind: "st/get", ref: "st_0" },
          { kind: "st/get", ref: "st_1" },
        ],
      },
    };
    await expect(foldAST(combined, node)).resolves.toEqual(["x", "b"]);
  });

  it("st/get is not cached (re-reads after mutation return new values)", async () => {
    const combined = { ...coreInterpreter, ...numInterpreter, ...createStInterpreter() };
    // Use the same st/get node object twice — if cached, second read would be stale.
    const getNode: TypedNode = { kind: "st/get", ref: "st_0" };
    const node: TypedNode = {
      kind: "core/begin",
      steps: [
        { kind: "st/let", ref: "st_0", initial: { kind: "core/literal", value: 1 } },
        // First read (will be 1)
        getNode,
        { kind: "st/set", ref: "st_0", value: { kind: "core/literal", value: 2 } },
      ],
      // Second read of same node object — must return 2, not cached 1
      result: getNode,
    };
    await expect(foldAST(combined, node)).resolves.toBe(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/tests/plugins/st/interpreter.test.ts`
Expected: FAIL (cannot find module `../../../src/plugins/st/interpreter`)

**Step 3: Commit**

```bash
git add packages/core/tests/plugins/st/interpreter.test.ts
git commit -m "test(st): add failing tests for st interpreter"
```

---

### Task 3: Implement the st interpreter

**Files:**
- Create: `packages/core/src/plugins/st/interpreter.ts`

**Step 1: Write the interpreter**

```typescript
import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_ } from "../../fold";

interface StLetNode extends TypedNode<void> {
  kind: "st/let";
  ref: string;
  initial: TypedNode;
}

interface StGetNode extends TypedNode<unknown> {
  kind: "st/get";
  ref: string;
}

interface StSetNode extends TypedNode<void> {
  kind: "st/set";
  ref: string;
  value: TypedNode;
}

interface StPushNode extends TypedNode<void> {
  kind: "st/push";
  ref: string;
  value: TypedNode;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "st/let": StLetNode;
    "st/get": StGetNode;
    "st/set": StSetNode;
    "st/push": StPushNode;
  }
}

/** Create a fresh st interpreter with its own mutable variable store. */
export function createStInterpreter() {
  const store = new Map<string, unknown>();

  return defineInterpreter<"st/let" | "st/get" | "st/set" | "st/push">()({
    "st/let": async function* (node: StLetNode) {
      const value = yield* eval_(node.initial);
      store.set(node.ref, value);
      return undefined;
    },

    "st/get": async function* (node: StGetNode) {
      if (!store.has(node.ref)) {
        throw new Error(`st/get: unknown ref "${node.ref}"`);
      }
      return store.get(node.ref);
    },

    "st/set": async function* (node: StSetNode) {
      const value = yield* eval_(node.value);
      store.set(node.ref, value);
      return undefined;
    },

    "st/push": async function* (node: StPushNode) {
      const value = yield* eval_(node.value);
      const arr = store.get(node.ref);
      if (!Array.isArray(arr)) {
        throw new Error(`st/push: ref "${node.ref}" is not an array`);
      }
      arr.push(value);
      return undefined;
    },
  });
}

/** Pre-created st interpreter instance for use as defaultInterpreter. */
export const stInterpreter = createStInterpreter();
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/core/tests/plugins/st/interpreter.test.ts`
Expected: PASS (all 7 tests)

**Step 3: Commit**

```bash
git add packages/core/src/plugins/st/interpreter.ts
git commit -m "feat(st): implement interpreter for st/let, st/get, st/set, st/push"
```

---

### Task 4: Wire up defaultInterpreter and exports

**Files:**
- Modify: `packages/core/src/plugins/st/index.ts:26` — add `defaultInterpreter`
- Modify: `packages/core/src/index.ts:73` — add interpreter exports

**Step 1: Add defaultInterpreter to st plugin definition**

In `packages/core/src/plugins/st/index.ts`, add the import and the property:

```typescript
import { stInterpreter } from "./interpreter";
```

Then change the `definePlugin` call to include `defaultInterpreter: stInterpreter`:

```typescript
export const st = definePlugin({
  name: "st",
  nodeKinds: ["st/let", "st/get", "st/set", "st/push"],
  defaultInterpreter: stInterpreter,
  build(ctx: PluginContext): StMethods {
```

**Step 2: Add exports to `packages/core/src/index.ts`**

After line 73 (`export { st } from "./plugins/st";`), add:

```typescript
export { createStInterpreter, stInterpreter } from "./plugins/st/interpreter";
```

**Step 3: Run the full build and tests**

Run: `npm run build -w packages/core && npm test -w packages/core`
Expected: PASS

**Step 4: Run the API extractor to update .api.md**

Run: `npm run check -w packages/core`
Expected: PASS (or api report update needed — if so, accept and commit the updated report)

**Step 5: Commit**

```bash
git add packages/core/src/plugins/st/index.ts packages/core/src/index.ts
git commit -m "feat(st): wire defaultInterpreter and add public exports"
```

If API reports changed:

```bash
git add packages/core/etc/
git commit -m "docs(st): update API report for st interpreter exports"
```
