# Strong-Type plugin-openai Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace untyped `unknown` generics in `@mvfm/plugin-openai` with real OpenAI SDK types, using core structural elaboration instead of custom `liftArg`/`openai-record`/`openai-array` plumbing.

**Architecture:** Add `Liftable<T>` type and `resolveStructured()` helper to core. Extend `elaborate()` to support per-arg shapes. Rewrite plugin constructors, KindSpecs, and interpreter to use these instead of custom liftArg machinery.

**Tech Stack:** TypeScript, OpenAI Node SDK 6.21.0, @mvfm/core

**Worktree:** `.worktrees/openai-strong-typing` (branch `openai-strong-typing`)

---

### Task 1: Add `Liftable<T>` type to core

**Files:**
- Create: `packages/core/src/liftable.ts`
- Modify: `packages/core/src/index.ts:44-51` (add export)
- Test: `packages/core/tests/liftable.type-test.ts`

**Step 1: Write the type-level test**

```typescript
// packages/core/tests/liftable.type-test.ts
import type { CExpr } from "../src/expr";
import type { Liftable } from "../src/liftable";

// Primitives: accept plain or CExpr
type L1 = Liftable<string>;
const _s1: L1 = "hello";
const _s2: L1 = {} as CExpr<string>;

type L2 = Liftable<number>;
const _n1: L2 = 42;
const _n2: L2 = {} as CExpr<number>;

// Null/undefined pass through
type L3 = Liftable<null>;
const _null: L3 = null;

// Object: each field is liftable
type Obj = { model: string; temperature?: number };
type L4 = Liftable<Obj>;
const _o1: L4 = { model: "gpt-4o" };
const _o2: L4 = { model: {} as CExpr<string> };
const _o3: L4 = { model: "gpt-4o", temperature: {} as CExpr<number> };
// Whole object as CExpr
const _o4: L4 = {} as CExpr<Obj>;

// Array: elements are liftable
type L5 = Liftable<string[]>;
const _a1: L5 = ["hello"];
const _a2: L5 = [{} as CExpr<string>];

// Nested object
type Nested = { messages: Array<{ role: string; content: string }> };
type L6 = Liftable<Nested>;
const _nested: L6 = {
  messages: [{ role: "user", content: {} as CExpr<string> }],
};

// @ts-expect-error - wrong type in field
const _bad: L4 = { model: 42 };
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/core exec tsc --noEmit packages/core/tests/liftable.type-test.ts 2>&1`
Expected: FAIL — module `../src/liftable` not found

**Step 3: Write the implementation**

```typescript
// packages/core/src/liftable.ts
/**
 * Liftable — utility type for accepting CExprs at any leaf position.
 *
 * Used by plugins that accept complex object parameters. Allows users
 * to embed CExpr values anywhere a primitive or sub-object is expected.
 */

import type { CExpr } from "./expr";

/**
 * Recursively allows `CExpr<X>` wherever `X` is expected in a type.
 *
 * - Primitives (string, number, boolean): accept plain value or `CExpr`
 * - null/undefined: pass through unchanged
 * - Arrays: each element is `Liftable`
 * - Objects: each field is `Liftable`, or the whole object can be a `CExpr`
 */
export type Liftable<T> =
  T extends CExpr<any, any, any>
    ? T
    : T extends string
      ? T | CExpr<string, any, any>
      : T extends number
        ? T | CExpr<number, any, any>
        : T extends boolean
          ? T | CExpr<boolean, any, any>
          : T extends null | undefined
            ? T
            : T extends readonly (infer E)[]
              ? readonly Liftable<E>[] | CExpr<T, any, any>
              : T extends object
                ? { [K in keyof T]: Liftable<T[K]> } | CExpr<T, any, any>
                : T | CExpr<T, any, any>;
```

**Step 4: Add export to index.ts**

In `packages/core/src/index.ts`, add to the types section (after line 51):

```typescript
export type { Liftable } from "./liftable";
```

**Step 5: Run type test to verify it passes**

Run: `pnpm --filter @mvfm/core exec tsc --noEmit 2>&1`
Expected: PASS (no errors)

**Step 6: Commit**

```bash
git add packages/core/src/liftable.ts packages/core/src/index.ts packages/core/tests/liftable.type-test.ts
git commit -m "feat(core): add Liftable<T> utility type for CExpr-in-object embedding"
```

---

### Task 2: Add `resolveStructured()` to core fold

**Files:**
- Modify: `packages/core/src/fold.ts:56` (add function after recurseScoped)
- Modify: `packages/core/src/index.ts:89` (add export)
- Test: `packages/core/tests/resolve-structured.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/tests/resolve-structured.test.ts
import { describe, expect, it } from "vitest";
import { resolveStructured } from "../src/fold";

describe("resolveStructured", () => {
  // Helper: run a resolveStructured generator against a mock memo
  async function resolve(structure: unknown, memo: Record<string, unknown>) {
    const gen = resolveStructured(structure);
    let result = await gen.next();
    while (!result.done) {
      const nodeId = result.value as string;
      result = await gen.next(memo[nodeId]);
    }
    return result.value;
  }

  it("yields string node IDs and returns resolved values", async () => {
    const result = await resolve("a", { a: "hello" });
    expect(result).toBe("hello");
  });

  it("resolves flat objects", async () => {
    const result = await resolve(
      { model: "a", temperature: "b" },
      { a: "gpt-4o", b: 0.7 },
    );
    expect(result).toEqual({ model: "gpt-4o", temperature: 0.7 });
  });

  it("resolves arrays", async () => {
    const result = await resolve(["a", "b"], { a: 1, b: 2 });
    expect(result).toEqual([1, 2]);
  });

  it("resolves nested objects", async () => {
    const result = await resolve(
      { messages: [{ role: "a", content: "b" }] },
      { a: "user", b: "Hello" },
    );
    expect(result).toEqual({ messages: [{ role: "user", content: "Hello" }] });
  });

  it("passes through non-string/object/array values", async () => {
    const result = await resolve(42 as unknown, {});
    expect(result).toBe(42);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/core run test -- resolve-structured`
Expected: FAIL — resolveStructured not exported

**Step 3: Write the implementation**

Add to `packages/core/src/fold.ts` after the `recurseScoped` function (after line 56):

```typescript
/**
 * Recursively resolve a structural child map by yielding node IDs to the fold.
 *
 * Used by plugin interpreters that handle structural shapes. Walks the
 * child structure (objects, arrays, node ID strings) and yields each
 * node ID to get its resolved value from the fold trampoline.
 *
 * @example
 * ```typescript
 * "myPlugin/create": async function* (entry) {
 *   const body = yield* resolveStructured(entry.children[0]);
 *   return await doSomething(body);
 * }
 * ```
 */
export async function* resolveStructured(
  structure: unknown,
): AsyncGenerator<string, unknown, unknown> {
  if (typeof structure === "string") return yield structure;
  if (Array.isArray(structure)) {
    const result: unknown[] = [];
    for (const item of structure) result.push(yield* resolveStructured(item));
    return result;
  }
  if (typeof structure === "object" && structure !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(structure))
      result[key] = yield* resolveStructured(value);
    return result;
  }
  return structure;
}
```

**Step 4: Add export to index.ts**

In `packages/core/src/index.ts`, modify line 89:

```typescript
export { createFoldState, recurseScoped, resolveStructured, VOLATILE_KINDS } from "./fold";
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @mvfm/core run test -- resolve-structured`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/fold.ts packages/core/src/index.ts packages/core/tests/resolve-structured.test.ts
git commit -m "feat(core): add resolveStructured() helper for structural shape interpreters"
```

---

### Task 3: Add per-arg shapes support to elaborate()

**Files:**
- Modify: `packages/core/src/elaborate.ts:168-175` (structural shapes branch)
- Test: `packages/core/tests/elaborate-per-arg-shapes.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/core/tests/elaborate-per-arg-shapes.test.ts
import { describe, expect, it } from "vitest";
import {
  boolPlugin,
  composeDollar,
  createApp,
  defaults,
  fold,
  numPlugin,
  resolveStructured,
  strPlugin,
} from "../src";
import type { CExpr, Interpreter, KindSpec, Plugin } from "../src";
import { makeCExpr } from "../src/expr";

/**
 * Test plugin with a multi-arg structural kind:
 * mytest/multi takes (id: string, params: object)
 * where id is a normal arg and params is structural.
 */
const testPlugin = {
  name: "mytest",
  ctors: {
    mytest: {
      multi(id: string, params: Record<string, unknown>): CExpr<unknown> {
        return makeCExpr("mytest/multi", [id, params]);
      },
    },
  },
  kinds: {
    "mytest/multi": {
      inputs: ["", undefined] as [string, unknown],
      output: undefined as unknown,
    } as KindSpec<[string, unknown], unknown>,
  },
  traits: {},
  lifts: {},
  shapes: { "mytest/multi": [null, "*"] },
  defaultInterpreter: (): Interpreter => ({
    "mytest/multi": async function* (entry) {
      const id = yield 0;
      const body = yield* resolveStructured(entry.children[1]);
      return { id, body };
    },
  }),
} satisfies Plugin;

const plugins = [numPlugin, strPlugin, boolPlugin, testPlugin] as const;
const $ = composeDollar(...plugins);
const app = createApp(...plugins);

describe("per-arg shapes: [null, '*']", () => {
  it("elaborates and folds correctly with mixed normal+structural args", async () => {
    const expr = $.mytest.multi("test-id", {
      name: "hello",
      count: 42,
    });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const interp = defaults(plugins);
    const result = (await fold(nexpr, interp)) as { id: string; body: Record<string, unknown> };
    expect(result.id).toBe("test-id");
    expect(result.body).toEqual({ name: "hello", count: 42 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/core run test -- elaborate-per-arg-shapes`
Expected: FAIL — structural shapes branch doesn't handle array shapes

**Step 3: Write the implementation**

In `packages/core/src/elaborate.ts`, replace lines 168-175:

```typescript
      // Structural kind — walk args with shape descriptor
      if (kind in structuralShapes) {
        const shape = structuralShapes[kind];
        const nodeId = counter;
        counter = incrementId(counter);
        if (Array.isArray(shape)) {
          // Per-arg shapes: [null, "*"] means arg0=normal visit, arg1=structural
          const childRefs: unknown[] = [];
          for (let i = 0; i < args.length; i++) {
            if (shape[i]) {
              childRefs.push(visitStructural(args[i], shape[i]));
            } else {
              childRefs.push(visit(args[i])[0]);
            }
          }
          entries[nodeId] = { kind, children: childRefs as string[], out: undefined };
        } else {
          // Single shape for args[0] (existing behavior for core/record, core/tuple)
          const childRef = visitStructural(args[0], shape);
          entries[nodeId] = { kind, children: [childRef] as any, out: undefined };
        }
        return cache([nodeId, kindOutputs[kind] ?? "object"]);
      }
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @mvfm/core run test -- elaborate-per-arg-shapes`
Expected: PASS

**Step 5: Run all core tests to verify no regression**

Run: `pnpm --filter @mvfm/core run test`
Expected: All tests pass

**Step 6: Build core**

Run: `pnpm --filter @mvfm/core run build`
Expected: No errors

**Step 7: Commit**

```bash
git add packages/core/src/elaborate.ts packages/core/tests/elaborate-per-arg-shapes.test.ts
git commit -m "feat(core): support per-arg shapes in elaborate() for mixed structural kinds"
```

---

### Task 4: Rewrite plugin constructors with OpenAI SDK types

**Files:**
- Modify: `packages/plugin-openai/src/6.21.0/index.ts` (full rewrite of constructors + kinds + shapes)

This is the main plugin change. We'll do it in one task since the constructor, KindSpec, and shapes changes are all interdependent.

**Step 1: Replace imports and remove liftArg**

At the top of `packages/plugin-openai/src/6.21.0/index.ts`, replace the imports and remove `liftArg` + `mk`:

```typescript
import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionDeleted,
  ChatCompletionListParams,
  ChatCompletionUpdateParams,
  ChatCompletionsPage,
} from "openai/resources/chat/completions/completions";
import type { Completion, CompletionCreateParamsNonStreaming } from "openai/resources/completions";
import type {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings";
import type {
  ModerationCreateParams,
  ModerationCreateResponse,
} from "openai/resources/moderations";
import { wrapOpenAISdk } from "./client-openai-sdk";
import { createOpenAIInterpreter, type OpenAIClient } from "./interpreter";
```

Delete the entire `liftArg` function (lines 31-55) and the `mk` helper (lines 59-62).

**Step 2: Rewrite buildOpenAIApi with typed constructors**

```typescript
function buildOpenAIApi() {
  return {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create(
          params: Liftable<ChatCompletionCreateParamsNonStreaming>,
        ): CExpr<ChatCompletion, "openai/create_chat_completion", [Liftable<ChatCompletionCreateParamsNonStreaming>]> {
          return makeCExpr("openai/create_chat_completion", [params]) as any;
        },
        /** Retrieve a chat completion by ID. */
        retrieve(
          id: string | CExpr<string>,
        ): CExpr<ChatCompletion, "openai/retrieve_chat_completion", [string | CExpr<string>]> {
          return makeCExpr("openai/retrieve_chat_completion", [id]) as any;
        },
        /** List chat completions with optional filter params. */
        list(
          ...params: [] | [Liftable<ChatCompletionListParams>]
        ): CExpr<ChatCompletionsPage, "openai/list_chat_completions", [] | [Liftable<ChatCompletionListParams>]> {
          return makeCExpr("openai/list_chat_completions", params) as any;
        },
        /** Update a chat completion by ID. */
        update(
          id: string | CExpr<string>,
          params: Liftable<ChatCompletionUpdateParams>,
        ): CExpr<ChatCompletion, "openai/update_chat_completion", [string | CExpr<string>, Liftable<ChatCompletionUpdateParams>]> {
          return makeCExpr("openai/update_chat_completion", [id, params]) as any;
        },
        /** Delete a chat completion by ID. */
        delete(
          id: string | CExpr<string>,
        ): CExpr<ChatCompletionDeleted, "openai/delete_chat_completion", [string | CExpr<string>]> {
          return makeCExpr("openai/delete_chat_completion", [id]) as any;
        },
      },
    },
    embeddings: {
      /** Create embeddings for the given input. */
      create(
        params: Liftable<EmbeddingCreateParams>,
      ): CExpr<CreateEmbeddingResponse, "openai/create_embedding", [Liftable<EmbeddingCreateParams>]> {
        return makeCExpr("openai/create_embedding", [params]) as any;
      },
    },
    moderations: {
      /** Classify text for policy compliance. */
      create(
        params: Liftable<ModerationCreateParams>,
      ): CExpr<ModerationCreateResponse, "openai/create_moderation", [Liftable<ModerationCreateParams>]> {
        return makeCExpr("openai/create_moderation", [params]) as any;
      },
    },
    completions: {
      /** Create a legacy completion (non-streaming). */
      create(
        params: Liftable<CompletionCreateParamsNonStreaming>,
      ): CExpr<Completion, "openai/create_completion", [Liftable<CompletionCreateParamsNonStreaming>]> {
        return makeCExpr("openai/create_completion", [params]) as any;
      },
    },
  };
}
```

**Step 3: Rewrite kinds with real types and add shapes**

Replace the entire `kinds` object and add `shapes`:

```typescript
kinds: {
  "openai/create_chat_completion": {
    inputs: [undefined] as [ChatCompletionCreateParamsNonStreaming],
    output: undefined as unknown as ChatCompletion,
  } as KindSpec<[ChatCompletionCreateParamsNonStreaming], ChatCompletion>,
  "openai/retrieve_chat_completion": {
    inputs: [""] as [string],
    output: undefined as unknown as ChatCompletion,
  } as KindSpec<[string], ChatCompletion>,
  "openai/list_chat_completions": {
    inputs: [] as ChatCompletionListParams[],
    output: undefined as unknown as ChatCompletionsPage,
  } as KindSpec<ChatCompletionListParams[], ChatCompletionsPage>,
  "openai/update_chat_completion": {
    inputs: ["", undefined] as [string, ChatCompletionUpdateParams],
    output: undefined as unknown as ChatCompletion,
  } as KindSpec<[string, ChatCompletionUpdateParams], ChatCompletion>,
  "openai/delete_chat_completion": {
    inputs: [""] as [string],
    output: undefined as unknown as ChatCompletionDeleted,
  } as KindSpec<[string], ChatCompletionDeleted>,
  "openai/create_embedding": {
    inputs: [undefined] as [EmbeddingCreateParams],
    output: undefined as unknown as CreateEmbeddingResponse,
  } as KindSpec<[EmbeddingCreateParams], CreateEmbeddingResponse>,
  "openai/create_moderation": {
    inputs: [undefined] as [ModerationCreateParams],
    output: undefined as unknown as ModerationCreateResponse,
  } as KindSpec<[ModerationCreateParams], ModerationCreateResponse>,
  "openai/create_completion": {
    inputs: [undefined] as [CompletionCreateParamsNonStreaming],
    output: undefined as unknown as Completion,
  } as KindSpec<[CompletionCreateParamsNonStreaming], Completion>,
},
shapes: {
  "openai/create_chat_completion": "*",
  "openai/list_chat_completions": "*",
  "openai/update_chat_completion": [null, "*"],
  "openai/create_embedding": "*",
  "openai/create_moderation": "*",
  "openai/create_completion": "*",
},
```

Note: `retrieve` and `delete` have no shapes — their args are strings, handled by normal lifting. `update` uses per-arg `[null, "*"]`.

**Step 4: Verify it builds**

Run: `pnpm --filter @mvfm/core run build && pnpm --filter @mvfm/plugin-openai exec tsc --noEmit`
Expected: No errors. If there are type errors, fix them.

**Step 5: Commit**

```bash
git add packages/plugin-openai/src/6.21.0/index.ts
git commit -m "feat(plugin-openai): type constructors and KindSpecs with OpenAI SDK types"
```

---

### Task 5: Rewrite interpreter to use resolveStructured

**Files:**
- Modify: `packages/plugin-openai/src/6.21.0/interpreter.ts`

**Step 1: Rewrite createOpenAIInterpreter**

Replace the entire `createOpenAIInterpreter` function:

```typescript
import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { resolveStructured } from "@mvfm/core";
// ... keep existing imports for wrapOpenAISdk, OpenAIConfig, OpenAIClient

export function createOpenAIInterpreter(client: OpenAIClient): Interpreter {
  return {
    "openai/create_chat_completion": async function* (entry: RuntimeEntry) {
      const body = yield* resolveStructured(entry.children[0]);
      return await client.request("POST", "/chat/completions", body as Record<string, unknown>);
    },

    "openai/retrieve_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/chat/completions/${id}`);
    },

    "openai/list_chat_completions": async function* (entry: RuntimeEntry) {
      const body = entry.children.length > 0
        ? ((yield* resolveStructured(entry.children[0])) as Record<string, unknown>)
        : undefined;
      return await client.request("GET", "/chat/completions", body);
    },

    "openai/update_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      const body = yield* resolveStructured(_entry.children[1]);
      return await client.request(
        "POST",
        `/chat/completions/${id}`,
        body as Record<string, unknown>,
      );
    },

    "openai/delete_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("DELETE", `/chat/completions/${id}`);
    },

    "openai/create_embedding": async function* (entry: RuntimeEntry) {
      const body = yield* resolveStructured(entry.children[0]);
      return await client.request("POST", "/embeddings", body as Record<string, unknown>);
    },

    "openai/create_moderation": async function* (entry: RuntimeEntry) {
      const body = yield* resolveStructured(entry.children[0]);
      return await client.request("POST", "/moderations", body as Record<string, unknown>);
    },

    "openai/create_completion": async function* (entry: RuntimeEntry) {
      const body = yield* resolveStructured(entry.children[0]);
      return await client.request("POST", "/completions", body as Record<string, unknown>);
    },
  };
}
```

No `openai/record` or `openai/array` handlers — they're gone.

**Step 2: Verify it builds**

Run: `pnpm --filter @mvfm/core run build && pnpm --filter @mvfm/plugin-openai exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/plugin-openai/src/6.21.0/interpreter.ts
git commit -m "feat(plugin-openai): use resolveStructured instead of openai/record handlers"
```

---

### Task 6: Update tests

**Files:**
- Modify: `packages/plugin-openai/tests/6.21.0/index.test.ts`
- Modify: `packages/plugin-openai/tests/6.21.0/interpreter.test.ts`
- Modify: `packages/plugin-openai/tests/6.21.0/composition.integration.test.ts`
- Modify: `packages/plugin-openai/tests/6.21.0/chat-completions.integration.test.ts`
- Modify: `packages/plugin-openai/tests/6.21.0/operations.integration.test.ts`

**Step 1: Update index.test.ts**

Key changes:
- CExpr construction tests: `expr.__args[0]` is now the raw object, NOT an `openai/record` CExpr
- Remove the `openai/record` assertion from create/update/list tests
- Update "has 10 node kinds" → "has 8 node kinds" (no more record/array)
- Remove or update tests that check for `openai/record` in args

For each `create`-style test, change:
```typescript
// Before:
const paramsArg = expr.__args[0] as { __kind: string };
expect(paramsArg.__kind).toBe("openai/record");

// After:
expect(expr.__args[0]).toEqual({ model: "gpt-4o", messages: [{ role: "user", content: "Hello" }] });
```

For the plugin shape test:
```typescript
// Before:
it("has 10 node kinds (8 core + record + array)", () => {
  expect(Object.keys(plugin.kinds)).toHaveLength(10);
});

// After:
it("has 8 node kinds", () => {
  expect(Object.keys(plugin.kinds)).toHaveLength(8);
});
```

**Step 2: Update interpreter.test.ts**

Remove the `as Parameters<typeof app>[0]` cast from the `run` helper:

```typescript
// Before:
const nexpr = app(expr as Parameters<typeof app>[0]);

// After:
const nexpr = app(expr);
```

Note: If the type-level elaboration can't handle the complex OpenAI types (TS recursion limit), keep the cast. This is the key "does it work?" moment.

**Step 3: Update integration test files**

Same change to `run` helper in each:
- `composition.integration.test.ts:25`
- `chat-completions.integration.test.ts:24`
- `operations.integration.test.ts:24`

**Step 4: Run all plugin tests**

Run: `pnpm --filter @mvfm/plugin-openai run test`
Expected: All 38 tests pass (or adjusted count if record/array tests were removed)

**Step 5: Run core tests too for full regression**

Run: `pnpm --filter @mvfm/core run test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/plugin-openai/tests/
git commit -m "test(plugin-openai): update tests for structural elaboration, remove openai/record refs"
```

---

### Task 7: Full build + check + final verification

**Files:** None (validation only)

**Step 1: Full build**

Run: `pnpm --filter @mvfm/core run build && pnpm --filter @mvfm/plugin-openai run build`
Expected: No errors

**Step 2: Full check (lint)**

Run: `pnpm run check` (or whatever the monorepo lint command is)
Expected: No errors

**Step 3: Full test suite**

Run: `pnpm --filter @mvfm/core run test && pnpm --filter @mvfm/plugin-openai run test`
Expected: All tests pass

**Step 4: Verify type safety works**

Create a quick scratch file and verify bad input causes a type error:

```typescript
// scratch-type-check.ts (delete after)
import { openai } from "./packages/plugin-openai/src/6.21.0";
const p = openai({ apiKey: "test" });
const api = p.ctors.openai;

// This should compile:
api.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

// @ts-expect-error — misspelled field
api.chat.completions.create({
  modle: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

// @ts-expect-error — missing required field
api.chat.completions.create({
  model: "gpt-4o",
});
```

Run: `pnpm --filter @mvfm/plugin-openai exec tsc --noEmit scratch-type-check.ts`
Expected: Only the @ts-expect-error lines cause errors (which is correct — they're expected errors)

**Step 5: Commit any remaining fixes**

If any fixes were needed, commit them.

---

### Task 8: Cleanup and PR

**Step 1: Review all changes**

Run: `git diff main --stat`
Verify: Only expected files changed

**Step 2: Use finishing-a-development-branch skill**

Invoke `superpowers:finishing-a-development-branch` to decide between merge/PR/cleanup.
