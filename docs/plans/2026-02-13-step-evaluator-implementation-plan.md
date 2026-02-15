# Step Evaluator and Client Interpreter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the monolithic `composeInterpreters` fold with a step-based evaluator (PureScript `resume` equivalent), then build a browser-side postgres client interpreter on top.

**Architecture:** Interpreter fragments become sync generators that yield `StepEffect`s. A `Stepper` class manages a trampoline (explicit heap stack) that advances one effect per `.tick()`. Three levels: Level 0 (raw stepping), Level 1 (`runAST` with handler), Level 2 (`foldAST` convenience fold). Client vs server is a handler-level distinction, not a fragment-level one.

**Tech Stack:** TypeScript generators, `@testcontainers/postgresql`, `node:http`, vitest

---

### Task 1: Add Step Types to core.ts

**Files:**
- Modify: `src/core.ts:170-204`

**Step 1: Write failing test**

Create `tests/step-evaluator.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { StepEffect, StepContext } from "../src/core";

describe("step types", () => {
  it("StepEffect discriminated union compiles for recurse", () => {
    const effect: StepEffect = { type: "recurse", child: { kind: "core/literal", value: 1 } };
    expect(effect.type).toBe("recurse");
  });

  it("StepEffect discriminated union compiles for custom effects", () => {
    const effect: StepEffect = { type: "query", sql: "SELECT 1", params: [] };
    expect(effect.type).toBe("query");
  });

  it("StepContext tracks depth and path", () => {
    const ctx: StepContext = { depth: 2, path: ["core/program", "postgres/query"] };
    expect(ctx.depth).toBe(2);
    expect(ctx.path).toEqual(["core/program", "postgres/query"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mikesol/Documents/GitHub/mvfm/mvfm && .venv/bin/python -c "print('skip')" && npx vitest run tests/step-evaluator.test.ts`
Expected: FAIL — `StepEffect` and `StepContext` don't exist yet.

**Step 3: Add types to core.ts**

Add after the `RecurseFn` interface (line 204), before the `isVolatile` function:

```typescript
// ---- Step Evaluator Types --------------------------------

/**
 * What an interpreter fragment wants to do at each step.
 *
 * `recurse` is structural traversal (evaluate a child node).
 * All other types are IO effects declared by plugins.
 * This is an open discriminated union — plugins extend it
 * by adding new `type` strings.
 */
export type StepEffect =
  | { type: "recurse"; child: ASTNode }
  | { type: string; [key: string]: unknown };

/**
 * Traversal metadata available at each step.
 * Used for proof accumulation, debugging, and 0-trust verification.
 */
export interface StepContext {
  /** How deep we are in the AST (0 = root). */
  depth: number;
  /** Node kinds traversed to reach this point. */
  path: string[];
  /** The node that requested this recursion, if any. */
  parentNode?: ASTNode;
}

/**
 * Result of a single step in the evaluator.
 *
 * @typeParam S - User-threaded state type.
 */
export type Step<S> =
  | { done: true; value: unknown; state: S }
  | {
      done: false;
      node: ASTNode;
      effect: StepEffect;
      context: StepContext;
      state: S;
    };

/**
 * Handler function for IO effects at Level 1.
 * Receives the effect, traversal context, and user state.
 * Returns the effect's result and updated state.
 *
 * @typeParam S - User-threaded state type.
 */
export type StepHandler<S> = (
  effect: StepEffect,
  context: StepContext,
  state: S,
) => Promise<{ value: unknown; state: S }>;
```

**Step 4: Export the new types from `src/index.ts`**

Add to `src/index.ts` line 3 (inside the type export block):

```typescript
export type {
  ASTNode,
  Expr,
  Interpreter,
  InterpreterFragment,
  Plugin,
  PluginContext,
  PluginDefinition,
  Program,
  RecurseFn,
  Step,
  StepContext,
  StepEffect,
  StepHandler,
  TraitImpl,
} from "./core";
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `npx vitest run --exclude '**/postgres/**'`
Expected: All non-postgres tests pass (postgres tests need testcontainers, skip for fast feedback).

**Step 7: Commit**

```bash
git add src/core.ts src/index.ts tests/step-evaluator.test.ts
git commit -m "feat: add StepEffect, StepContext, Step, StepHandler types"
```

---

### Task 2: Add GeneratorInterpreterFragment and adaptLegacy

**Files:**
- Modify: `src/core.ts`
- Modify: `src/index.ts`
- Modify: `tests/step-evaluator.test.ts`

**Step 1: Write failing test**

Append to `tests/step-evaluator.test.ts`:

```typescript
import { adaptLegacy } from "../src/core";
import type { LegacyInterpreterFragment, GeneratorInterpreterFragment } from "../src/core";

describe("adaptLegacy", () => {
  it("wraps a legacy fragment into a generator fragment", () => {
    const legacy: LegacyInterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/val",
      async visit(node, recurse) {
        return node.value;
      },
    };
    const adapted = adaptLegacy(legacy);
    expect(adapted.pluginName).toBe("test");
    expect(adapted.canHandle({ kind: "test/val" })).toBe(true);
    // visit returns a generator
    const gen = adapted.visit({ kind: "test/val", value: 42 });
    expect(gen.next).toBeDefined(); // it's a generator
  });

  it("adapted fragment yields a __legacy effect", () => {
    const legacy: LegacyInterpreterFragment = {
      pluginName: "test",
      canHandle: (node) => node.kind === "test/val",
      async visit(node, _recurse) {
        return node.value;
      },
    };
    const adapted = adaptLegacy(legacy);
    const gen = adapted.visit({ kind: "test/val", value: 42 });
    const step = gen.next();
    expect(step.done).toBe(false);
    expect((step.value as any).type).toBe("__legacy");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: FAIL — `adaptLegacy`, `LegacyInterpreterFragment`, `GeneratorInterpreterFragment` don't exist.

**Step 3: Add types and adaptLegacy to core.ts**

Add after the `StepHandler` type:

```typescript
/**
 * Legacy interpreter fragment using the callback-based visit signature.
 * Kept for backward compatibility during migration.
 */
export interface LegacyInterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>;
}

/**
 * New interpreter fragment using sync generators.
 * Yields {@link StepEffect}s and receives results via `yield`.
 */
export interface GeneratorInterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
  /** Declare which node kinds are volatile (never cached). */
  isVolatile?: (node: ASTNode) => boolean;
}

/**
 * Wrap a legacy callback-based fragment as a generator fragment.
 * The legacy visit runs as a single opaque `__legacy` effect.
 */
export function adaptLegacy(fragment: LegacyInterpreterFragment): GeneratorInterpreterFragment {
  return {
    pluginName: fragment.pluginName,
    canHandle: fragment.canHandle,
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      return yield { type: "__legacy", fragment, node } as StepEffect;
    },
  };
}
```

**Step 4: Export from index.ts**

Add to the type exports:

```typescript
export type { LegacyInterpreterFragment, GeneratorInterpreterFragment } from "./core";
```

Add to the value exports (near `composeInterpreters`):

```typescript
export { adaptLegacy, composeInterpreters, mvfm } from "./core";
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core.ts src/index.ts tests/step-evaluator.test.ts
git commit -m "feat: add LegacyInterpreterFragment, GeneratorInterpreterFragment, adaptLegacy"
```

---

### Task 3: Implement Stepper Class

**Files:**
- Modify: `src/core.ts`
- Modify: `src/index.ts`
- Modify: `tests/step-evaluator.test.ts`

This is the largest task. The `Stepper` manages the trampoline — an explicit stack of generator frames on the heap.

**Step 1: Write failing tests**

Append to `tests/step-evaluator.test.ts`:

```typescript
import { Stepper } from "../src/core";
import type { GeneratorInterpreterFragment, StepEffect } from "../src/core";

describe("Stepper", () => {
  // A trivial fragment that returns literals directly
  const literalFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/literal",
    *visit(node) {
      return node.value;
    },
  };

  // A fragment that recurses into a child
  const addFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/add",
    *visit(node) {
      const left = yield { type: "recurse", child: node.left };
      const right = yield { type: "recurse", child: node.right };
      return (left as number) + (right as number);
    },
  };

  // A fragment that yields an IO effect
  const queryFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/query",
    *visit(node) {
      return yield { type: "query", sql: node.sql, params: [] };
    },
  };

  const fragments = [literalFragment, addFragment, queryFragment];

  it("steps through a literal (immediate done)", () => {
    const stepper = new Stepper({ kind: "test/literal", value: 42 }, fragments);
    const step = stepper.tick();
    expect(step.done).toBe(true);
    if (step.done) expect(step.value).toBe(42);
  });

  it("steps through add with recurse effects", () => {
    const node = {
      kind: "test/add",
      left: { kind: "test/literal", value: 10 },
      right: { kind: "test/literal", value: 20 },
    };
    const stepper = new Stepper(node, fragments);

    // First tick: add generator yields recurse for left
    const step1 = stepper.tick();
    expect(step1.done).toBe(false);
    if (!step1.done) {
      expect(step1.effect.type).toBe("recurse");
      // Descend into left child
      stepper.descend((step1.effect as any).child);
    }

    // Second tick: literal generator completes immediately (value=10)
    // Then add generator yields recurse for right
    const step2 = stepper.tick();
    expect(step2.done).toBe(false);
    if (!step2.done) {
      expect(step2.effect.type).toBe("recurse");
      stepper.descend((step2.effect as any).child);
    }

    // Third tick: literal generator completes (value=20)
    // Then add generator completes (10+20=30)
    const step3 = stepper.tick();
    expect(step3.done).toBe(true);
    if (step3.done) expect(step3.value).toBe(30);
  });

  it("steps through IO effect (query)", () => {
    const node = { kind: "test/query", sql: "SELECT 1" };
    const stepper = new Stepper(node, fragments);

    // First tick: query generator yields query effect
    const step1 = stepper.tick();
    expect(step1.done).toBe(false);
    if (!step1.done) {
      expect(step1.effect.type).toBe("query");
      expect((step1.effect as any).sql).toBe("SELECT 1");
    }

    // Provide the result and tick again
    const step2 = stepper.tick([{ ok: 1 }]);
    expect(step2.done).toBe(true);
    if (step2.done) expect(step2.value).toEqual([{ ok: 1 }]);
  });

  it("tracks context depth and path", () => {
    const node = {
      kind: "test/add",
      left: { kind: "test/literal", value: 1 },
      right: { kind: "test/literal", value: 2 },
    };
    const stepper = new Stepper(node, fragments);

    const step1 = stepper.tick();
    if (!step1.done) {
      expect(step1.context.depth).toBe(0);
      expect(step1.context.path).toEqual(["test/add"]);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: FAIL — `Stepper` doesn't exist.

**Step 3: Implement Stepper**

Add to `src/core.ts` after `adaptLegacy`:

```typescript
/** A frame on the Stepper's explicit stack. */
interface TrampolineFrame {
  gen: Generator<StepEffect, unknown, unknown>;
  node: ASTNode;
}

/**
 * Step-based AST evaluator (Level 0).
 *
 * Manages a trampoline — an explicit stack of generator frames on the heap.
 * Each `.tick()` call advances one step. The call stack never grows past 1 frame.
 *
 * @typeParam S - User-threaded state type (defaults to void).
 */
export class Stepper<S = void> {
  private stack: TrampolineFrame[] = [];
  private fragments: GeneratorInterpreterFragment[];
  private cache = new WeakMap<ASTNode, unknown>();
  private tainted = new WeakSet<ASTNode>();
  private lastResult: unknown = undefined;
  private pendingDescend: ASTNode | null = null;
  private contextPath: string[] = [];

  constructor(root: ASTNode, fragments: GeneratorInterpreterFragment[]) {
    this.fragments = fragments;
    const fragment = this.findFragment(root);
    this.stack.push({ gen: fragment.visit(root), node: root });
    this.contextPath.push(root.kind);
  }

  private findFragment(node: ASTNode): GeneratorInterpreterFragment {
    const f = this.fragments.find((f) => f.canHandle(node));
    if (!f) throw new Error(`No interpreter for node kind: ${node.kind}`);
    return f;
  }

  private isVolatile(node: ASTNode): boolean {
    for (const f of this.fragments) {
      if (f.isVolatile?.(node)) return true;
    }
    return false;
  }

  /**
   * Push a child generator onto the stack (for handling recurse effects).
   * The next `.tick()` will advance the child.
   */
  descend(child: ASTNode): void {
    // Check cache first
    if (!this.tainted.has(child)) {
      const cached = this.cache.get(child);
      if (cached !== undefined) {
        this.lastResult = cached;
        return;
      }
    }
    this.pendingDescend = child;
  }

  /**
   * Advance one step.
   *
   * @param lastResult - The result of handling the previous effect (for IO effects).
   *   Ignored if the previous tick was a descend that resolved from cache.
   * @returns The next step (done or a new effect to handle).
   */
  tick(lastResult?: unknown): Step<S> {
    if (lastResult !== undefined) {
      this.lastResult = lastResult;
    }

    // Handle pending descend
    if (this.pendingDescend) {
      const child = this.pendingDescend;
      this.pendingDescend = null;
      const fragment = this.findFragment(child);
      this.stack.push({ gen: fragment.visit(child), node: child });
      this.contextPath.push(child.kind);
      this.lastResult = undefined;
    }

    // Trampoline loop — process generator completions without surfacing them as steps
    while (this.stack.length > 0) {
      const frame = this.stack[this.stack.length - 1];
      const iterResult = frame.gen.next(this.lastResult);

      if (iterResult.done) {
        // Generator completed — cache result, pop stack, feed to parent
        this.stack.pop();
        this.contextPath.pop();
        const value = iterResult.value;

        // Cache unless volatile
        if (!this.isVolatile(frame.node)) {
          this.cache.set(frame.node, value);
        }
        if (this.isVolatile(frame.node) || hasAnyTaintedChild(frame.node, this.tainted)) {
          this.tainted.add(frame.node);
          this.cache.delete(frame.node);
        }

        if (this.stack.length === 0) {
          // Done — no more frames
          return { done: true, value, state: undefined as S };
        }

        // Feed result to parent generator on next iteration
        this.lastResult = value;
        continue;
      }

      // Generator yielded an effect
      const effect = iterResult.value;
      this.lastResult = undefined;

      return {
        done: false,
        node: frame.node,
        effect,
        context: {
          depth: this.stack.length - 1,
          path: [...this.contextPath],
          parentNode: this.stack.length > 1 ? this.stack[this.stack.length - 2].node : undefined,
        },
        state: undefined as S,
      };
    }

    // Should not reach here
    throw new Error("Stepper: stack is empty but tick was called");
  }

  /** Create a new Stepper with a fresh (empty) cache over the same root. */
  fresh(root: ASTNode): Stepper<S> {
    return new Stepper(root, this.fragments);
  }
}
```

**Step 4: Export from index.ts**

Add `Stepper` to the value exports:

```typescript
export { adaptLegacy, composeInterpreters, mvfm, Stepper } from "./core";
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core.ts src/index.ts tests/step-evaluator.test.ts
git commit -m "feat: implement Stepper class (Level 0 step evaluator)"
```

---

### Task 4: Implement runAST (Level 1) and foldAST (Level 2)

**Files:**
- Modify: `src/core.ts`
- Modify: `src/index.ts`
- Modify: `tests/step-evaluator.test.ts`

**Step 1: Write failing tests**

Append to `tests/step-evaluator.test.ts`:

```typescript
import { runAST, foldAST } from "../src/core";

describe("runAST (Level 1)", () => {
  const literalFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/literal",
    *visit(node) {
      return node.value;
    },
  };

  const addFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/add",
    *visit(node) {
      const left = yield { type: "recurse", child: node.left };
      const right = yield { type: "recurse", child: node.right };
      return (left as number) + (right as number);
    },
  };

  const queryFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/query",
    *visit(node) {
      return yield { type: "query", sql: node.sql, params: [] };
    },
  };

  const fragments = [literalFragment, addFragment, queryFragment];

  it("auto-handles recurse, delegates IO to handler", async () => {
    const node = {
      kind: "test/add",
      left: { kind: "test/query", sql: "SELECT 1" },
      right: { kind: "test/literal", value: 5 },
    };

    const { value, state } = await runAST(
      node,
      fragments,
      async (effect, _context, state) => {
        if (effect.type === "query") {
          return { value: 10, state: state + 1 };
        }
        throw new Error(`Unexpected effect: ${effect.type}`);
      },
      0, // initial state: count of queries
    );

    expect(value).toBe(15); // query returned 10, literal is 5, add = 15
    expect(state).toBe(1); // one query was handled
  });

  it("threads state through multiple effects", async () => {
    const node = {
      kind: "test/add",
      left: { kind: "test/query", sql: "SELECT 1" },
      right: { kind: "test/query", sql: "SELECT 2" },
    };

    const { state } = await runAST(
      node,
      fragments,
      async (effect, _context, state) => {
        return { value: 1, state: [...state, (effect as any).sql] };
      },
      [] as string[],
    );

    expect(state).toEqual(["SELECT 1", "SELECT 2"]);
  });
});

describe("foldAST (Level 2)", () => {
  const literalFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/literal",
    *visit(node) {
      return node.value;
    },
  };

  const addFragment: GeneratorInterpreterFragment = {
    pluginName: "test",
    canHandle: (node) => node.kind === "test/add",
    *visit(node) {
      const left = yield { type: "recurse", child: node.left };
      const right = yield { type: "recurse", child: node.right };
      return (left as number) + (right as number);
    },
  };

  it("returns a RecurseFn that evaluates pure ASTs", async () => {
    const node = {
      kind: "test/add",
      left: { kind: "test/literal", value: 3 },
      right: { kind: "test/literal", value: 7 },
    };

    const recurse = foldAST([literalFragment, addFragment], {});
    const result = await recurse(node);
    expect(result).toBe(10);
  });

  it("has a fresh() method for cache reset", async () => {
    const recurse = foldAST([literalFragment, addFragment], {});
    const fresh = recurse.fresh();
    expect(fresh).not.toBe(recurse);
    const node = { kind: "test/literal", value: 99 };
    expect(await fresh(node)).toBe(99);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: FAIL — `runAST` and `foldAST` don't exist.

**Step 3: Implement runAST and foldAST**

Add to `src/core.ts` after the `Stepper` class:

```typescript
/**
 * Level 1: Handler-driven step evaluation.
 *
 * Auto-handles `recurse` effects (with caching). IO effects are delegated
 * to the handler, which also threads user-defined state.
 *
 * @typeParam S - User-threaded state type.
 */
export async function runAST<S>(
  root: ASTNode,
  fragments: GeneratorInterpreterFragment[],
  handler: StepHandler<S>,
  initialState: S,
): Promise<{ value: unknown; state: S }> {
  const stepper = new Stepper<S>(root, fragments);
  let state = initialState;
  let lastResult: unknown = undefined;
  let firstTick = true;

  while (true) {
    const step = firstTick ? stepper.tick() : stepper.tick(lastResult);
    firstTick = false;

    if (step.done) {
      return { value: step.value, state };
    }

    if (step.effect.type === "recurse") {
      stepper.descend((step.effect as { type: "recurse"; child: ASTNode }).child);
      lastResult = undefined;
      firstTick = true;
      continue;
    }

    if (step.effect.type === "__legacy") {
      // Handle legacy fragment: run its visit with a recurse function built from foldAST
      const legacyEffect = step.effect as { type: "__legacy"; fragment: LegacyInterpreterFragment; node: ASTNode };
      const legacyRecurse = foldAST(
        fragments,
        Object.fromEntries([["__handler", handler]]) as any,
      );
      lastResult = await legacyEffect.fragment.visit(legacyEffect.node, legacyRecurse);
      continue;
    }

    // IO effect — delegate to handler
    const result = await handler(step.effect, step.context, state);
    lastResult = result.value;
    state = result.state;
  }
}

/**
 * Level 2: Convenience fold — evaluates the AST using effect handlers.
 *
 * Returns a {@link RecurseFn} compatible with the old `composeInterpreters` API.
 *
 * @param fragments - Generator-based interpreter fragments.
 * @param handlers - Map of effect type → handler function.
 */
export function foldAST(
  fragments: GeneratorInterpreterFragment[],
  handlers: Record<string, (effect: StepEffect) => Promise<unknown>>,
): RecurseFn {
  const handler: StepHandler<void> = async (effect, _context, state) => {
    const h = handlers[effect.type];
    if (!h) {
      throw new Error(`foldAST: no handler for effect type "${effect.type}"`);
    }
    const value = await h(effect);
    return { value, state };
  };

  async function recurse(node: ASTNode): Promise<unknown> {
    const { value } = await runAST(node, fragments, handler, undefined);
    return value;
  }

  (recurse as RecurseFn).fresh = () => foldAST(fragments, handlers);
  return recurse as RecurseFn;
}
```

**Step 4: Export from index.ts**

```typescript
export { adaptLegacy, composeInterpreters, foldAST, mvfm, runAST, Stepper } from "./core";
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/step-evaluator.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core.ts src/index.ts tests/step-evaluator.test.ts
git commit -m "feat: implement runAST (Level 1) and foldAST (Level 2)"
```

---

### Task 5: Migrate Core Interpreter to Generator

**Files:**
- Modify: `src/interpreters/core.ts`

The core interpreter handles `core/` node kinds. The migration is mechanical: replace `await recurse(child)` with `yield { type: "recurse", child }`.

**Step 1: Rewrite the core interpreter**

Replace the contents of `src/interpreters/core.ts`:

```typescript
import type { GeneratorInterpreterFragment, StepEffect } from "../core";
import type { ASTNode } from "../core";

/** Interpreter fragment for core node kinds (literal, input, prop_access, cond, do, program, tuple, record). */
export const coreInterpreter: GeneratorInterpreterFragment = {
  pluginName: "core",
  canHandle: (node) => node.kind.startsWith("core/"),
  isVolatile: (node) => node.kind === "core/lambda_param",
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "core/literal":
        return node.value;

      case "core/input":
        return (node as any).__inputData;

      case "core/prop_access": {
        const obj = (yield { type: "recurse", child: node.object as ASTNode }) as Record<string, unknown>;
        return obj[node.property as string];
      }

      case "core/record": {
        const fields = node.fields as Record<string, ASTNode>;
        const result: Record<string, unknown> = {};
        for (const [key, fieldNode] of Object.entries(fields)) {
          result[key] = yield { type: "recurse", child: fieldNode };
        }
        return result;
      }

      case "core/cond": {
        const predicate = yield { type: "recurse", child: node.predicate as ASTNode };
        return predicate
          ? yield { type: "recurse", child: node.then as ASTNode }
          : yield { type: "recurse", child: node.else as ASTNode };
      }

      case "core/do": {
        const steps = node.steps as ASTNode[];
        for (const step of steps) {
          yield { type: "recurse", child: step };
        }
        return yield { type: "recurse", child: node.result as ASTNode };
      }

      case "core/program":
        return yield { type: "recurse", child: node.result as ASTNode };

      case "core/tuple": {
        const elements = node.elements as ASTNode[];
        const results: unknown[] = [];
        for (const el of elements) {
          results.push(yield { type: "recurse", child: el });
        }
        return results;
      }

      case "core/lambda_param":
        return (node as any).__value;

      default:
        throw new Error(`Core interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Key changes from the original:**
- `async visit(node, recurse)` → `*visit(node)` (sync generator, no recurse param)
- `await recurse(child)` → `yield { type: "recurse", child }`
- `Promise.all(elements.map(recurse))` → sequential loop with `yield` (generators can't yield inside `map` callbacks)
- Added `isVolatile` for `core/lambda_param`

**Step 2: Run core interpreter tests**

Run: `npx vitest run tests/interpreters/core.test.ts`
Expected: FAIL — the tests use `composeInterpreters` which expects `InterpreterFragment` (old signature). This will fail because `coreInterpreter` now has a generator `visit`.

**Step 3: Update composeInterpreters to accept both types**

Modify `composeInterpreters` in `src/core.ts` to detect and adapt both fragment types. Replace the existing `composeInterpreters` function:

```typescript
/**
 * Compose interpreter fragments into a full interpreter.
 *
 * Accepts both legacy (callback-based) and generator-based fragments.
 * Legacy fragments are auto-wrapped via {@link adaptLegacy}.
 *
 * Built on top of {@link foldAST} (Level 2).
 */
export function composeInterpreters(
  fragments: (InterpreterFragment | LegacyInterpreterFragment | GeneratorInterpreterFragment)[],
): RecurseFn {
  // Normalize: wrap legacy fragments, pass generator fragments through
  const normalized = fragments.map((f) => {
    if ("visit" in f && f.visit.constructor.name === "GeneratorFunction") {
      return f as GeneratorInterpreterFragment;
    }
    // Legacy fragment
    return adaptLegacy(f as LegacyInterpreterFragment);
  });

  return foldAST(normalized, {});
}
```

**Note:** Detecting generator functions via `constructor.name` is fragile. A more robust approach: check if the visit function has `length === 1` (generator takes only `node`) vs `length === 2` (legacy takes `node, recurse`):

```typescript
export function composeInterpreters(
  fragments: (InterpreterFragment | LegacyInterpreterFragment | GeneratorInterpreterFragment)[],
): RecurseFn {
  const normalized = fragments.map((f) => {
    // Generator fragments have visit(node) — arity 1
    // Legacy fragments have visit(node, recurse) — arity 2
    if (f.visit.length <= 1) {
      return f as GeneratorInterpreterFragment;
    }
    return adaptLegacy(f as LegacyInterpreterFragment);
  });

  return foldAST(normalized, {});
}
```

Also remove the old `isVolatile`, `isASTLike`, and `hasAnyTaintedChild` helper functions only if they're no longer used. Keep `isASTLike` and `hasAnyTaintedChild` since `Stepper` needs them. Remove the standalone `isVolatile` since volatility is now per-fragment.

**Step 4: Run core interpreter tests again**

Run: `npx vitest run tests/interpreters/core.test.ts`
Expected: PASS

**Step 5: Run full non-postgres test suite**

Run: `npx vitest run --exclude '**/postgres/**'`
Expected: All pass. This confirms the legacy adapter works for non-migrated interpreters (num, str, boolean, eq, ord, error, fiber are still legacy).

**Step 6: Commit**

```bash
git add src/core.ts src/interpreters/core.ts
git commit -m "refactor: migrate core interpreter to generator, update composeInterpreters"
```

---

### Task 6: Migrate Postgres Interpreter to Generator

**Files:**
- Modify: `src/plugins/postgres/3.4.8/interpreter.ts`

**Step 1: Refactor the postgres interpreter**

Replace `src/plugins/postgres/3.4.8/interpreter.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect } from "../../../core";

/**
 * Database client interface consumed by the postgres interpreter.
 *
 * Abstracts over the actual database driver so interpreters can be
 * tested with mock clients.
 */
export interface PostgresClient {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  begin<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  savepoint<T>(fn: (tx: PostgresClient) => Promise<T>): Promise<T>;
  cursor(
    sql: string,
    params: unknown[],
    batchSize: number,
    fn: (rows: unknown[]) => Promise<undefined | false>,
  ): Promise<void>;
}

// Escape identifier — matches postgres.js src/types.js:216
function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""').replace(/\./g, '"."')}"`;
}

interface BuiltQuery {
  sql: string;
  params: unknown[];
}

/**
 * Build parameterized SQL from a postgres/query AST node.
 * Yields recurse effects for each parameter that needs evaluation.
 */
function* buildSQL(
  node: ASTNode,
): Generator<StepEffect, BuiltQuery, unknown> {
  const strings = node.strings as string[];
  const paramNodes = node.params as ASTNode[];
  let sql = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    sql += strings[i];
    if (i < paramNodes.length) {
      const param = paramNodes[i];
      if (param.kind === "postgres/identifier") {
        const name = (yield { type: "recurse", child: param.name as ASTNode }) as string;
        sql += escapeIdentifier(name);
      } else if (param.kind === "postgres/insert_helper") {
        const data = (yield { type: "recurse", child: param.data as ASTNode }) as
          | Record<string, unknown>
          | Record<string, unknown>[];
        const columns =
          (param.columns as string[] | null) ?? Object.keys(Array.isArray(data) ? data[0] : data);
        const rows = Array.isArray(data) ? data : [data];
        sql +=
          "(" +
          columns.map(escapeIdentifier).join(",") +
          ") values " +
          rows
            .map(
              (row) =>
                "(" +
                columns
                  .map((col) => {
                    params.push(row[col]);
                    return `$${params.length}`;
                  })
                  .join(",") +
                ")",
            )
            .join(",");
      } else if (param.kind === "postgres/set_helper") {
        const data = (yield { type: "recurse", child: param.data as ASTNode }) as Record<string, unknown>;
        const columns = (param.columns as string[] | null) ?? Object.keys(data);
        sql += columns
          .map((col) => {
            params.push(data[col]);
            return `${escapeIdentifier(col)}=$${params.length}`;
          })
          .join(",");
      } else {
        // Regular parameter — recurse to get the value
        params.push(yield { type: "recurse", child: param });
        sql += `$${params.length}`;
      }
    }
  }

  return { sql, params };
}

function findCursorBatch(node: any): any | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCursorBatch(item);
      if (found) return found;
    }
    return null;
  }
  if (node.kind === "postgres/cursor_batch") return node;
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      const found = findCursorBatch(v);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Interpreter fragment for postgres plugin nodes.
 *
 * Yields IO effects for database operations (query, begin, savepoint, cursor).
 * The handler decides how to execute them (direct DB call, HTTP proxy, mock, etc).
 */
export const postgresInterpreter: GeneratorInterpreterFragment = {
  pluginName: "postgres",
  canHandle: (node) => node.kind.startsWith("postgres/"),
  isVolatile: (node) => node.kind === "postgres/cursor_batch",
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "postgres/query": {
        const { sql, params } = yield* buildSQL(node);
        return yield { type: "query", sql, params };
      }

      case "postgres/begin": {
        return yield {
          type: "begin",
          mode: node.mode as string,
          body: node.body as ASTNode | undefined,
          queries: node.queries as ASTNode[] | undefined,
          config: node.config,
        };
      }

      case "postgres/savepoint": {
        return yield {
          type: "savepoint",
          mode: node.mode as string,
          body: node.body as ASTNode | undefined,
          queries: node.queries as ASTNode[] | undefined,
        };
      }

      case "postgres/cursor": {
        const queryNode = node.query as ASTNode;
        const { sql, params } = yield* buildSQL(queryNode);
        const batchSize = (yield { type: "recurse", child: node.batchSize as ASTNode }) as number;
        return yield {
          type: "cursor",
          sql,
          params,
          batchSize,
          body: node.body as ASTNode,
        };
      }

      case "postgres/cursor_batch":
        return (node as any).__batchData;

      // These are resolved inline by buildSQL, never visited directly
      case "postgres/identifier":
      case "postgres/insert_helper":
      case "postgres/set_helper":
        throw new Error(
          `${node.kind} should be resolved during SQL construction, not visited directly`,
        );

      default:
        throw new Error(`Postgres interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Key changes:**
- `postgresInterpreter` is now a `GeneratorInterpreterFragment` (const, not a function)
- It no longer takes `client` or `outerFragments` params — those are handler concerns
- `visit` is a sync generator
- `buildSQL` is a generator using `yield*` delegation
- DB operations yield effects (`query`, `begin`, `savepoint`, `cursor`)
- Added `isVolatile` for `postgres/cursor_batch`

**Step 2: Run existing postgres tests (they will fail)**

Run: `npx vitest run tests/plugins/postgres/3.4.8/interpreter.test.ts`
Expected: FAIL — the tests call `postgresInterpreter(client, nonPgFragments)` but it no longer takes arguments.

The tests will be updated in Task 8 after the handlers are ready.

**Step 3: Commit**

```bash
git add src/plugins/postgres/3.4.8/interpreter.ts
git commit -m "refactor: migrate postgres interpreter to generator with StepEffects"
```

---

### Task 7: Create Server and Client Handlers

**Files:**
- Create: `src/plugins/postgres/3.4.8/handler.server.ts`
- Create: `src/plugins/postgres/3.4.8/handler.client.ts`
- Modify: `src/index.ts`

**Step 1: Write failing tests**

Create `tests/plugins/postgres/3.4.8/handler.server.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { StepEffect, StepContext } from "../../../../src/core";
import { serverHandler } from "../../../../src/plugins/postgres/3.4.8/handler.server";
import type { PostgresClient } from "../../../../src/plugins/postgres/3.4.8/interpreter";

describe("serverHandler", () => {
  it("handles query effects by calling client.query", async () => {
    const mockClient: PostgresClient = {
      async query(sql, params) { return [{ sql, params }]; },
      async begin(fn) { return fn(mockClient); },
      async savepoint(fn) { return fn(mockClient); },
      async cursor() {},
    };

    const handler = serverHandler(mockClient, []);
    const effect: StepEffect = { type: "query", sql: "SELECT 1", params: [] };
    const ctx: StepContext = { depth: 0, path: [] };
    const result = await handler(effect, ctx, undefined);

    expect(result.value).toEqual([{ sql: "SELECT 1", params: [] }]);
  });
});
```

Create `tests/plugins/postgres/3.4.8/handler.client.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { StepEffect, StepContext } from "../../../../src/core";
import { clientHandler } from "../../../../src/plugins/postgres/3.4.8/handler.client";

describe("clientHandler", () => {
  it("sends effects over HTTP and returns results", async () => {
    const requests: any[] = [];
    const mockFetch = async (url: string, init: any) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ result: [{ ok: 1 }] }) } as Response;
    };

    const handler = clientHandler({
      baseUrl: "http://localhost:3000",
      contractHash: "abc123",
      fetch: mockFetch as typeof globalThis.fetch,
    });

    const effect: StepEffect = { type: "query", sql: "SELECT 1", params: [] };
    const ctx: StepContext = { depth: 0, path: ["postgres/query"] };
    const result = await handler(effect, ctx, { stepIndex: 0 });

    expect(result.value).toEqual([{ ok: 1 }]);
    expect(result.state.stepIndex).toBe(1);
    expect(requests[0].url).toBe("http://localhost:3000/mvfm/execute");
    expect(requests[0].body.contractHash).toBe("abc123");
    expect(requests[0].body.effect.type).toBe("query");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plugins/postgres/3.4.8/handler.server.test.ts tests/plugins/postgres/3.4.8/handler.client.test.ts`
Expected: FAIL — files don't exist.

**Step 3: Implement handler.server.ts**

Create `src/plugins/postgres/3.4.8/handler.server.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { PostgresClient } from "./interpreter";
import { findCursorBatch } from "./interpreter";

/**
 * Server-side effect handler for postgres operations.
 *
 * Wraps a {@link PostgresClient} and executes effects directly against the database.
 * Transactions and savepoints create sub-steppers with scoped clients.
 */
export function serverHandler(
  client: PostgresClient,
  fragments: GeneratorInterpreterFragment[],
): StepHandler<void> {
  return async (effect: StepEffect, _context, state) => {
    switch (effect.type) {
      case "query": {
        const e = effect as { type: "query"; sql: string; params: unknown[] };
        const value = await client.query(e.sql, e.params);
        return { value, state };
      }

      case "begin": {
        const e = effect as {
          type: "begin";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };
        const value = await client.begin(async (tx) => {
          const txHandler = serverHandler(tx, fragments);
          if (e.mode === "pipeline" && e.queries) {
            const results: unknown[] = [];
            for (const q of e.queries) {
              const r = await runAST(q, fragments, txHandler, undefined);
              results.push(r.value);
            }
            return results;
          }
          if (e.body) {
            const r = await runAST(e.body, fragments, txHandler, undefined);
            return r.value;
          }
          throw new Error("begin: no body or queries");
        });
        return { value, state };
      }

      case "savepoint": {
        const e = effect as {
          type: "savepoint";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };
        const value = await client.savepoint(async (tx) => {
          const txHandler = serverHandler(tx, fragments);
          if (e.mode === "pipeline" && e.queries) {
            const results: unknown[] = [];
            for (const q of e.queries) {
              const r = await runAST(q, fragments, txHandler, undefined);
              results.push(r.value);
            }
            return results;
          }
          if (e.body) {
            const r = await runAST(e.body, fragments, txHandler, undefined);
            return r.value;
          }
          throw new Error("savepoint: no body or queries");
        });
        return { value, state };
      }

      case "cursor": {
        const e = effect as {
          type: "cursor";
          sql: string;
          params: unknown[];
          batchSize: number;
          body: ASTNode;
        };
        const batchNode = findCursorBatch(e.body);
        await client.cursor(e.sql, e.params, e.batchSize, async (rows) => {
          if (batchNode) {
            batchNode.__batchData = rows;
          }
          const txHandler = serverHandler(client, fragments);
          await runAST(e.body, fragments, txHandler, undefined);
          return undefined;
        });
        return { value: undefined, state };
      }

      default:
        throw new Error(`serverHandler: unknown effect type "${effect.type}"`);
    }
  };
}
```

**Note:** The `findCursorBatch` function needs to be exported from `interpreter.ts`. Add `export` to its declaration there.

**Step 4: Implement handler.client.ts**

Create `src/plugins/postgres/3.4.8/handler.client.ts`:

```typescript
import type { StepEffect, StepHandler } from "../../../core";

/** State threaded through the client handler. */
export interface ClientHandlerState {
  stepIndex: number;
}

/**
 * Client-side effect handler for postgres operations.
 *
 * Sends effects over HTTP to a server endpoint with contract metadata
 * for 0-trust verification.
 */
export function clientHandler(options: {
  baseUrl: string;
  contractHash: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
}): StepHandler<ClientHandlerState> {
  return async (effect: StepEffect, context, state) => {
    const resolvedHeaders =
      typeof options.headers === "function"
        ? await options.headers()
        : options.headers ?? {};

    const res = await (options.fetch ?? globalThis.fetch)(
      `${options.baseUrl}/mvfm/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...resolvedHeaders },
        body: JSON.stringify({
          contractHash: options.contractHash,
          step: state.stepIndex,
          effect,
          path: context.path,
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`mvfm proxy: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 5: Export from index.ts**

Add to `src/index.ts`:

```typescript
export { serverHandler } from "./plugins/postgres/3.4.8/handler.server";
export { clientHandler } from "./plugins/postgres/3.4.8/handler.client";
export type { ClientHandlerState } from "./plugins/postgres/3.4.8/handler.client";
```

**Step 6: Run handler tests**

Run: `npx vitest run tests/plugins/postgres/3.4.8/handler.server.test.ts tests/plugins/postgres/3.4.8/handler.client.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/plugins/postgres/3.4.8/handler.server.ts src/plugins/postgres/3.4.8/handler.client.ts src/plugins/postgres/3.4.8/interpreter.ts src/index.ts tests/plugins/postgres/3.4.8/handler.server.test.ts tests/plugins/postgres/3.4.8/handler.client.test.ts
git commit -m "feat: add serverHandler and clientHandler for postgres effects"
```

---

### Task 8: Update Existing Postgres Tests

**Files:**
- Modify: `tests/plugins/postgres/3.4.8/interpreter.test.ts`

The existing tests use `composeInterpreters([postgresInterpreter(client, nonPgFragments), ...nonPgFragments])`. Since `postgresInterpreter` is now a const (not a function), and the handler provides the client, we need to update the test helper.

**Step 1: Update the test file**

Key changes to `makeInterp()` and imports:

```typescript
// Old:
import { postgresInterpreter } from "../../../../src/plugins/postgres/3.4.8/interpreter";
// ...
function makeInterp() {
  const client = wrapPostgresJs(sql);
  return composeInterpreters([postgresInterpreter(client, nonPgFragments), ...nonPgFragments]);
}

// New:
import { postgresInterpreter } from "../../../../src/plugins/postgres/3.4.8/interpreter";
import { serverHandler } from "../../../../src/plugins/postgres/3.4.8/handler.server";
import { foldAST } from "../../../../src/core";
import type { GeneratorInterpreterFragment } from "../../../../src/core";
// ...
const allFragments = [postgresInterpreter, ...nonPgFragments] as GeneratorInterpreterFragment[];

function makeInterp() {
  const client = wrapPostgresJs(sql);
  const handler = serverHandler(client, allFragments);
  // Build a RecurseFn that delegates IO to the handler
  return foldAST(allFragments, {
    query: async (e: any) => client.query(e.sql, e.params),
    begin: async (e: any) => handler(e, { depth: 0, path: [] }, undefined).then(r => r.value),
    savepoint: async (e: any) => handler(e, { depth: 0, path: [] }, undefined).then(r => r.value),
    cursor: async (e: any) => handler(e, { depth: 0, path: [] }, undefined).then(r => r.value),
  });
}
```

**Actually, simpler approach**: use `runAST` directly with `serverHandler` instead of `foldAST`, since `serverHandler` already handles all postgres effect types. Update the `run` helper:

```typescript
import { runAST } from "../../../../src/core";
import { serverHandler } from "../../../../src/plugins/postgres/3.4.8/handler.server";

const allFragments = [postgresInterpreter, ...nonPgFragments];

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapPostgresJs(sql);
  const handler = serverHandler(client, allFragments as any);
  const { value } = await runAST(ast.result, allFragments as any, handler, undefined);
  return value;
}
```

Note: `nonPgFragments` are still legacy-style. `composeInterpreters` auto-adapts them via `adaptLegacy` (detected by `visit.length`). But `runAST` only accepts `GeneratorInterpreterFragment[]`. So we need to adapt them manually or update `runAST` to accept both.

**Better approach**: update `runAST` and `foldAST` to accept mixed fragment types (same as `composeInterpreters`). Add a normalization step at the top of `runAST`:

In `src/core.ts`, add a helper:

```typescript
function normalizeFragments(
  fragments: (InterpreterFragment | LegacyInterpreterFragment | GeneratorInterpreterFragment)[],
): GeneratorInterpreterFragment[] {
  return fragments.map((f) => {
    if (f.visit.length <= 1) return f as GeneratorInterpreterFragment;
    return adaptLegacy(f as LegacyInterpreterFragment);
  });
}
```

Use it in `runAST`, `foldAST`, `Stepper`, and `composeInterpreters`.

Then the test just becomes:

```typescript
async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapPostgresJs(sql);
  const allFragments = [postgresInterpreter, ...nonPgFragments];
  const handler = serverHandler(client, allFragments as any);
  const { value } = await runAST(ast.result, allFragments as any, handler, undefined);
  return value;
}
```

**Step 2: Run postgres tests**

Run: `npx vitest run tests/plugins/postgres/3.4.8/interpreter.test.ts`
Expected: PASS — all existing postgres tests pass with the new architecture.

**Step 3: Commit**

```bash
git add tests/plugins/postgres/3.4.8/interpreter.test.ts src/core.ts
git commit -m "test: update postgres tests to use runAST + serverHandler"
```

---

### Task 9: Integration Test — Full Round-Trip

**Files:**
- Create: `tests/plugins/postgres/3.4.8/round-trip.test.ts`

This test proves that the same program produces identical results whether executed directly via `serverHandler` or proxied via `clientHandler` → HTTP → `serverHandler`.

**Step 1: Write the test**

```typescript
import * as http from "node:http";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { eq } from "../../../../src/plugins/eq";
import { eqInterpreter } from "../../../../src/plugins/eq/interpreter";
import { ord } from "../../../../src/plugins/ord";
import { ordInterpreter } from "../../../../src/plugins/ord/interpreter";
import { semiring } from "../../../../src/plugins/semiring";
import { postgres as pgPlugin } from "../../../../src/plugins/postgres/3.4.8";
import { wrapPostgresJs } from "../../../../src/plugins/postgres/3.4.8/client-postgres-js";
import { postgresInterpreter } from "../../../../src/plugins/postgres/3.4.8/interpreter";
import { serverHandler } from "../../../../src/plugins/postgres/3.4.8/handler.server";
import { clientHandler } from "../../../../src/plugins/postgres/3.4.8/handler.client";

let container: StartedPostgreSqlContainer;
let sql: ReturnType<typeof postgres>;
let httpServer: http.Server;
let serverPort: number;

const nonPgFragments = [coreInterpreter, numInterpreter, strInterpreter, eqInterpreter, ordInterpreter];
const allFragments = [postgresInterpreter, ...nonPgFragments];

const app = mvfm(num, str, semiring, eq, ord, pgPlugin("postgres://test"));

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

beforeAll(async () => {
  // Start Postgres
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  sql = postgres(container.getConnectionUri());
  await sql`CREATE TABLE items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INT)`;
  await sql`INSERT INTO items (name, price) VALUES ('Widget', 10), ('Gadget', 25), ('Doohickey', 5)`;

  // Start HTTP server that wraps serverHandler
  httpServer = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/mvfm/execute") {
      res.writeHead(404);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const client = wrapPostgresJs(sql);
    const handler = serverHandler(client, allFragments as any);

    try {
      const result = await handler(body.effect, { depth: 0, path: body.path ?? [] }, undefined);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: result.value }));
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      serverPort = (httpServer.address() as any).port;
      resolve();
    });
  });
}, 60000);

afterAll(async () => {
  httpServer?.close();
  await sql?.end();
  await container?.stop();
});

describe("round-trip: direct vs proxied", () => {
  it("SELECT produces identical results", async () => {
    const prog = app(($) => $.sql`SELECT * FROM items ORDER BY id`);
    const ast = prog.ast;

    // Direct: serverHandler
    const client = wrapPostgresJs(sql);
    const directHandler = serverHandler(client, allFragments as any);
    const direct = await runAST(ast.result, allFragments as any, directHandler, undefined);

    // Proxied: clientHandler → HTTP → serverHandler
    const proxyHandler = clientHandler({
      baseUrl: `http://localhost:${serverPort}`,
      contractHash: prog.hash,
      fetch: globalThis.fetch,
    });
    const proxied = await runAST(ast.result, allFragments as any, proxyHandler, { stepIndex: 0 });

    expect(proxied.value).toEqual(direct.value);
  });

  it("parameterized query produces identical results", async () => {
    const prog = app(
      { minPrice: "number" },
      ($) => $.sql`SELECT * FROM items WHERE price > ${$.input.minPrice} ORDER BY price`,
    );
    const ast = injectInput(prog.ast, { minPrice: 8 });

    const client = wrapPostgresJs(sql);
    const directHandler = serverHandler(client, allFragments as any);
    const direct = await runAST(ast.result, allFragments as any, directHandler, undefined);

    const proxyHandler = clientHandler({
      baseUrl: `http://localhost:${serverPort}`,
      contractHash: prog.hash,
      fetch: globalThis.fetch,
    });
    const proxied = await runAST(
      injectInput(prog.ast, { minPrice: 8 }).result,
      allFragments as any,
      proxyHandler,
      { stepIndex: 0 },
    );

    expect(proxied.value).toEqual(direct.value);
  });
});
```

**Step 2: Run the test**

Run: `npx vitest run tests/plugins/postgres/3.4.8/round-trip.test.ts`
Expected: PASS — both direct and proxied execution produce identical results.

**Step 3: Commit**

```bash
git add tests/plugins/postgres/3.4.8/round-trip.test.ts
git commit -m "test: add round-trip integration test (direct vs proxied execution)"
```

---

### Task 10: Migrate Trivial Interpreters (num, str, boolean, eq, ord)

**Files:**
- Modify: `src/plugins/num/interpreter.ts`
- Modify: `src/plugins/str/interpreter.ts`
- Modify: `src/plugins/boolean/interpreter.ts`
- Modify: `src/plugins/eq/interpreter.ts`
- Modify: `src/plugins/ord/interpreter.ts`

All five follow the same mechanical pattern. Here's the transform:

```
await recurse(node.X as ASTNode)  →  yield { type: "recurse", child: node.X as ASTNode }
Promise.all(nodes.map(recurse))   →  sequential loop with yield
async visit(node, recurse)        →  *visit(node)
InterpreterFragment               →  GeneratorInterpreterFragment
```

**Step 1: Migrate num interpreter**

Replace `src/plugins/num/interpreter.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect } from "../../core";

/** Interpreter fragment for `num/` node kinds. */
export const numInterpreter: GeneratorInterpreterFragment = {
  pluginName: "num",
  canHandle: (node) => node.kind.startsWith("num/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "num/add":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) +
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/sub":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) -
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/mul":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) *
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/div":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) /
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/mod":
        return (
          ((yield { type: "recurse", child: node.left as ASTNode }) as number) %
          ((yield { type: "recurse", child: node.right as ASTNode }) as number)
        );
      case "num/compare": {
        const l = (yield { type: "recurse", child: node.left as ASTNode }) as number;
        const r = (yield { type: "recurse", child: node.right as ASTNode }) as number;
        return l < r ? -1 : l === r ? 0 : 1;
      }
      case "num/neg":
        return -((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/abs":
        return Math.abs((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/floor":
        return Math.floor((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/ceil":
        return Math.ceil((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/round":
        return Math.round((yield { type: "recurse", child: node.operand as ASTNode }) as number);
      case "num/min": {
        const values: number[] = [];
        for (const v of node.values as ASTNode[]) {
          values.push((yield { type: "recurse", child: v }) as number);
        }
        return Math.min(...values);
      }
      case "num/max": {
        const values: number[] = [];
        for (const v of node.values as ASTNode[]) {
          values.push((yield { type: "recurse", child: v }) as number);
        }
        return Math.max(...values);
      }
      case "num/eq":
        return (yield { type: "recurse", child: node.left as ASTNode }) ===
          (yield { type: "recurse", child: node.right as ASTNode });
      case "num/zero":
        return 0;
      case "num/one":
        return 1;
      case "num/show":
        return String(yield { type: "recurse", child: node.operand as ASTNode });
      case "num/top":
        return Infinity;
      case "num/bottom":
        return -Infinity;
      default:
        throw new Error(`Num interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 2: Migrate str, boolean, eq, ord** using the same pattern. Each one:
- Change import to `GeneratorInterpreterFragment, StepEffect`
- Change type annotation from `InterpreterFragment` to `GeneratorInterpreterFragment`
- Change `async visit(node, recurse)` to `*visit(node)`
- Change `await recurse(X)` to `yield { type: "recurse", child: X }`
- Change `Promise.all(arr.map(recurse))` to sequential loop

**Step 3: Run all interpreter tests**

Run: `npx vitest run tests/plugins/num tests/plugins/str tests/plugins/boolean tests/plugins/eq tests/plugins/ord`
Expected: PASS

**Step 4: Commit**

```bash
git add src/plugins/num/interpreter.ts src/plugins/str/interpreter.ts src/plugins/boolean/interpreter.ts src/plugins/eq/interpreter.ts src/plugins/ord/interpreter.ts
git commit -m "refactor: migrate num, str, boolean, eq, ord interpreters to generators"
```

---

### Task 11: Migrate Error Interpreter

**Files:**
- Modify: `src/plugins/error/interpreter.ts`

This one needs care — it uses `injectLambdaParam` and try/catch. The try/catch pattern becomes an effect because the error interpreter needs to control flow based on whether an expression throws.

**Key insight**: The error interpreter uses `try { await recurse(expr) } catch (e) { ... }`. In the generator model, `recurse` is a `yield` — and you can't catch errors from a yielded value. The stepper handles the recursion, and if the child throws, the stepper itself throws.

**Solution**: The error interpreter yields a special `try_recurse` effect that asks the stepper to evaluate a child and return `{ok, err}` instead of throwing. Or simpler: keep `error/try`, `error/attempt`, `error/settle` as effects that the handler manages (since they need async error handling).

Replace `src/plugins/error/interpreter.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect } from "../../core";

/**
 * Walk an AST subtree and inject a value into matching lambda_param nodes.
 */
function injectLambdaParam(node: any, param: { name: string }, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, param, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === param.name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, param, value);
    }
  }
}

/** Interpreter fragment for `error/` node kinds. */
export const errorInterpreter: GeneratorInterpreterFragment = {
  pluginName: "error",
  canHandle: (node) => node.kind.startsWith("error/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "error/try":
        return yield { type: "error/try", node };

      case "error/fail": {
        const error = yield { type: "recurse", child: node.error as ASTNode };
        throw error;
      }

      case "error/attempt":
        return yield { type: "error/attempt", expr: node.expr as ASTNode };

      case "error/guard": {
        const condition = yield { type: "recurse", child: node.condition as ASTNode };
        if (!condition) {
          throw yield { type: "recurse", child: node.error as ASTNode };
        }
        return undefined;
      }

      case "error/settle":
        return yield { type: "error/settle", exprs: node.exprs as ASTNode[] };

      default:
        throw new Error(`Error interpreter: unknown node kind "${node.kind}"`);
    }
  },
};

export { injectLambdaParam };
```

These error effects (`error/try`, `error/attempt`, `error/settle`) must be handled by an error effect handler. Add `src/plugins/error/handler.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect, StepHandler } from "../../core";
import { runAST } from "../../core";
import { injectLambdaParam } from "./interpreter";

/**
 * Effect handler for error/ effects.
 * Must be composed with other handlers to handle try/attempt/settle.
 */
export function errorHandler(
  fragments: GeneratorInterpreterFragment[],
  innerHandler: StepHandler<any>,
): StepHandler<any> {
  return async (effect: StepEffect, context, state) => {
    switch (effect.type) {
      case "error/try": {
        const node = (effect as any).node as ASTNode;
        try {
          const { value } = await runAST(node.expr as ASTNode, fragments, innerHandler, undefined);
          return { value, state };
        } catch (e) {
          if (node.catch) {
            const catchInfo = node.catch as { param: ASTNode; body: ASTNode };
            injectLambdaParam(catchInfo.body, catchInfo.param as any, e);
            const { value } = await runAST(catchInfo.body, fragments, innerHandler, undefined);
            return { value, state };
          }
          if (node.match) {
            const matchInfo = node.match as {
              param: ASTNode;
              branches: Record<string, ASTNode>;
            };
            const errObj = e as any;
            const key = typeof errObj === "string" ? errObj : (errObj?.code ?? errObj?.type ?? "_");
            const branch = matchInfo.branches[key] ?? matchInfo.branches._ ?? null;
            if (!branch) throw e;
            injectLambdaParam(branch, matchInfo.param as any, e);
            const { value } = await runAST(branch, fragments, innerHandler, undefined);
            return { value, state };
          }
          throw e;
        } finally {
          if (node.finally) {
            await runAST(node.finally as ASTNode, fragments, innerHandler, undefined);
          }
        }
      }

      case "error/attempt": {
        const expr = (effect as any).expr as ASTNode;
        try {
          const { value } = await runAST(expr, fragments, innerHandler, undefined);
          return { value: { ok: value, err: null }, state };
        } catch (e) {
          return { value: { ok: null, err: e }, state };
        }
      }

      case "error/settle": {
        const exprs = (effect as any).exprs as ASTNode[];
        const results = await Promise.allSettled(
          exprs.map((e) => runAST(e, fragments, innerHandler, undefined).then((r) => r.value)),
        );
        const fulfilled: unknown[] = [];
        const rejected: unknown[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") fulfilled.push(r.value);
          else rejected.push(r.reason);
        }
        return { value: { fulfilled, rejected }, state };
      }

      default:
        return innerHandler(effect, context, state);
    }
  };
}
```

**Step 2: Run error interpreter tests**

Run: `npx vitest run tests/plugins/error/interpreter.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/error/interpreter.ts src/plugins/error/handler.ts
git commit -m "refactor: migrate error interpreter to generator with effect handler"
```

---

### Task 12: Migrate Fiber Interpreter

**Files:**
- Modify: `src/plugins/fiber/interpreter.ts`

Same pattern as error — concurrency operations (`par_map`, `race`, `settle`) become effects handled by a fiber handler.

Replace `src/plugins/fiber/interpreter.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect } from "../../core";

/**
 * Walk an AST subtree and inject a value into matching lambda_param nodes.
 */
function injectLambdaParam(node: any, name: string, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, name, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, name, value);
    }
  }
}

/** Interpreter fragment for `fiber/` node kinds. */
export const fiberInterpreter: GeneratorInterpreterFragment = {
  pluginName: "fiber",
  canHandle: (node) => node.kind.startsWith("fiber/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "fiber/par_map":
        return yield {
          type: "fiber/par_map",
          collection: node.collection as ASTNode,
          concurrency: node.concurrency as number,
          param: node.param as ASTNode,
          body: node.body as ASTNode,
        };

      case "fiber/race":
        return yield {
          type: "fiber/race",
          branches: node.branches as ASTNode[],
        };

      case "fiber/timeout":
        return yield {
          type: "fiber/timeout",
          expr: node.expr as ASTNode,
          ms: node.ms as ASTNode,
          fallback: node.fallback as ASTNode,
        };

      case "fiber/retry":
        return yield {
          type: "fiber/retry",
          expr: node.expr as ASTNode,
          attempts: node.attempts as number,
          delay: (node.delay as number) ?? 0,
        };

      default:
        throw new Error(`Fiber interpreter: unknown node kind "${node.kind}"`);
    }
  },
};

export { injectLambdaParam as injectFiberLambdaParam };
```

Create `src/plugins/fiber/handler.ts`:

```typescript
import type { ASTNode, GeneratorInterpreterFragment, StepEffect, StepHandler } from "../../core";
import { runAST } from "../../core";
import { injectFiberLambdaParam } from "./interpreter";

/**
 * Effect handler for fiber/ effects (concurrency).
 */
export function fiberHandler(
  fragments: GeneratorInterpreterFragment[],
  innerHandler: StepHandler<any>,
): StepHandler<any> {
  return async (effect: StepEffect, context, state) => {
    switch (effect.type) {
      case "fiber/par_map": {
        const e = effect as any;
        // Resolve the collection first
        const { value: collection } = await runAST(e.collection, fragments, innerHandler, undefined);
        const items = collection as unknown[];
        const concurrency = e.concurrency as number;
        const results: unknown[] = [];

        for (let i = 0; i < items.length; i += concurrency) {
          const batch = items.slice(i, i + concurrency);
          const batchResults = await Promise.all(
            batch.map((item) => {
              const bodyClone = structuredClone(e.body);
              injectFiberLambdaParam(bodyClone, (e.param as any).name, item);
              return runAST(bodyClone, fragments, innerHandler, undefined).then((r) => r.value);
            }),
          );
          results.push(...batchResults);
        }
        return { value: results, state };
      }

      case "fiber/race": {
        const branches = (effect as any).branches as ASTNode[];
        const value = await Promise.race(
          branches.map((b) => runAST(b, fragments, innerHandler, undefined).then((r) => r.value)),
        );
        return { value, state };
      }

      case "fiber/timeout": {
        const e = effect as any;
        const { value: ms } = await runAST(e.ms, fragments, innerHandler, undefined);
        const expr = runAST(e.expr, fragments, innerHandler, undefined).then((r) => r.value);
        let timerId: ReturnType<typeof setTimeout>;
        const timer = new Promise<unknown>((resolve) => {
          timerId = setTimeout(async () => {
            const { value } = await runAST(e.fallback, fragments, innerHandler, undefined);
            resolve(value);
          }, ms as number);
        });
        const value = await Promise.race([expr, timer]).finally(() => clearTimeout(timerId!));
        return { value, state };
      }

      case "fiber/retry": {
        const e = effect as any;
        const attempts = e.attempts as number;
        const delay = e.delay as number;
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
          try {
            const { value } = await runAST(e.expr, fragments, innerHandler, undefined);
            return { value, state };
          } catch (err) {
            lastError = err;
            if (i < attempts - 1 && delay > 0) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }

      default:
        return innerHandler(effect, context, state);
    }
  };
}
```

**Step 2: Run fiber interpreter tests**

Run: `npx vitest run tests/plugins/fiber/interpreter.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/fiber/interpreter.ts src/plugins/fiber/handler.ts
git commit -m "refactor: migrate fiber interpreter to generator with effect handler"
```

---

### Task 13: Delete Legacy Shim and Clean Up

**Files:**
- Modify: `src/core.ts`
- Modify: `src/index.ts`

All interpreters are now generators. Remove the backward compatibility layer.

**Step 1: Remove legacy types and functions from core.ts**

- Delete `LegacyInterpreterFragment` interface
- Delete `adaptLegacy` function
- Delete `__legacy` handling from `Stepper` (if any)
- Remove the `normalizeFragments` helper (no longer needed)
- Update `InterpreterFragment` to be an alias for `GeneratorInterpreterFragment`
- Update `composeInterpreters` to only accept `GeneratorInterpreterFragment[]`

The old `InterpreterFragment` interface becomes:

```typescript
/**
 * An Interpreter fragment that uses sync generators to yield effects.
 * This is the only fragment type — the legacy callback-based interface
 * has been fully migrated.
 */
export interface InterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
  /** Declare which node kinds are volatile (never cached). */
  isVolatile?: (node: ASTNode) => boolean;
}
```

Remove the `GeneratorInterpreterFragment` type (it's now just `InterpreterFragment`).

Update all imports across all interpreter files from `GeneratorInterpreterFragment` back to `InterpreterFragment`.

**Step 2: Remove legacy exports from index.ts**

Remove `LegacyInterpreterFragment`, `GeneratorInterpreterFragment`, `adaptLegacy`.

**Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Run type check and lint**

Run: `npm run build && npm run check`
Expected: Clean

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete legacy interpreter shim, InterpreterFragment is now generator-based"
```

---

### Task 14: Final Validation

**Files:** None — validation only.

**Step 1: Full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Type check and lint**

Run: `npm run build && npm run check`
Expected: Clean.

**Step 3: Run integration tests specifically**

Run: `npx vitest run tests/plugins/postgres/3.4.8/round-trip.test.ts`
Expected: PASS — direct and proxied execution produce identical results.

**Step 4: Verify API report is up to date**

Run: `npx api-extractor run --local`
Expected: Clean (or expected changes reflecting new exports).

**Step 5: Commit any API report changes**

```bash
git add -A
git commit -m "chore: update API report for step evaluator exports"
```
