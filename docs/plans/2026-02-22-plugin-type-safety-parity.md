# Plugin Type Safety Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `nodeKinds`, add full `KindSpec` types to every plugin, and prove type safety parity with core via tests.

**Architecture:** Remove `nodeKinds` from `Plugin` and `PluginDef` interfaces. Replace all `nodeKinds` reads with `Object.keys(plugin.kinds)`. Port every plugin to declare typed `KindSpec` entries. Add type-safety and end-to-end tests for each plugin.

**Tech Stack:** TypeScript, vitest, testcontainers (postgres, redis), localstack (s3), fixture mocks (slack, openai, etc.)

---

## Task 1: Remove `nodeKinds` from core interfaces

**Files:**
- Modify: `packages/core/src/plugin.ts:68` — remove `nodeKinds` from `Plugin`
- Modify: `packages/core/src/fold.ts:71-75` — remove `nodeKinds` from `PluginDef`, add `kinds`
- Modify: `packages/core/src/fold.ts:259` — replace `plugin.nodeKinds.length === 0` with `Object.keys(plugin.kinds).length === 0`
- Modify: `scripts/check-docs-coverage.ts:93` — replace `plugin.nodeKinds` with `Object.keys(plugin.kinds)`
- Modify: `packages/core/src/compat.ts:57` — update `definePlugin` signature

**Step 1: Update `Plugin` interface**

In `packages/core/src/plugin.ts`, remove line 68:
```typescript
// DELETE this line:
readonly nodeKinds: readonly string[];
```

**Step 2: Update `PluginDef` interface**

In `packages/core/src/fold.ts`, replace lines 71-75:
```typescript
/** Minimal plugin definition for defaults(). */
export interface PluginDef {
  name: string;
  kinds: Record<string, unknown>;
  defaultInterpreter?: () => Interpreter;
}
```

**Step 3: Update `defaults()` logic**

In `packages/core/src/fold.ts`, replace line 259:
```typescript
// Before:
} else if (plugin.nodeKinds.length === 0) {
// After:
} else if (Object.keys(plugin.kinds).length === 0) {
```

**Step 4: Update coverage script**

In `scripts/check-docs-coverage.ts`, replace line 93:
```typescript
// Before:
const kindNames = plugin.nodeKinds ?? (plugin.kinds ? Object.keys(plugin.kinds) : []);
// After:
const kindNames = plugin.kinds ? Object.keys(plugin.kinds) : [];
```

Also on line 103, remove the `nodeKinds` fallback:
```typescript
// Before:
const kindMap = trait.mapping ?? trait.nodeKinds;
// After:
const kindMap = trait.mapping;
```

**Step 5: Update compat.ts**

In `packages/core/src/compat.ts`, replace line 57:
```typescript
// Before:
export function definePlugin<T extends { name: string; nodeKinds: string[] }>(def: T): T {
// After:
export function definePlugin<T extends { name: string; kinds: Record<string, unknown> }>(def: T): T {
```

**Step 6: Verify build breaks expectedly**

Run: `cd packages/core && npx tsc --noEmit 2>&1 | head -50`
Expected: Errors in every file that still references `nodeKinds`. This confirms the interface change propagated.

**Step 7: Commit**

```bash
git add packages/core/src/plugin.ts packages/core/src/fold.ts packages/core/src/compat.ts scripts/check-docs-coverage.ts
git commit -m "feat(core): remove nodeKinds from Plugin and PluginDef interfaces (#299)"
```

---

## Task 2: Port std plugins (num, str, bool, ord)

These already have full `kinds` records. Just delete their `nodeKinds` arrays.

**Files:**
- Modify: `packages/core/src/std-plugins.ts:102-124` — delete `nodeKinds` from `numPlugin`
- Modify: `packages/core/src/std-plugins-str.ts` — delete `nodeKinds` from `strPlugin`
- Modify: `packages/core/src/std-plugins-bool.ts` — delete `nodeKinds` from `boolPlugin`
- Modify: `packages/core/src/std-plugins-ord.ts` — delete `nodeKinds` from `ordPlugin`

**Step 1: Delete `nodeKinds` from each std plugin**

In `packages/core/src/std-plugins.ts`, delete lines 102-124 (the `nodeKinds` array from `numPlugin`).

Repeat for strPlugin, boolPlugin, ordPlugin in their respective files. Each has a `nodeKinds` array that duplicates `Object.keys(kinds)`.

**Step 2: Verify std plugins compile**

Run: `cd packages/core && npx tsc --noEmit 2>&1 | grep -c "nodeKinds"`
Expected: Errors should NOT mention std-plugins files anymore.

**Step 3: Commit**

```bash
git add packages/core/src/std-plugins.ts packages/core/src/std-plugins-str.ts packages/core/src/std-plugins-bool.ts packages/core/src/std-plugins-ord.ts
git commit -m "refactor(core): remove nodeKinds from std plugins (#299)"
```

---

## Task 3: Port internal plugins (st, control, error, fiber) with real KindSpec

These currently have `kinds: {}`. Need real KindSpec entries.

**Files:**
- Modify: `packages/core/src/st.ts:30,33` — replace empty kinds, delete nodeKinds
- Modify: `packages/core/src/control.ts` — replace empty kinds, delete nodeKinds
- Modify: `packages/core/src/error.ts` — replace empty kinds, delete nodeKinds
- Modify: `packages/core/src/fiber.ts` — replace empty kinds, delete nodeKinds

**Step 1: Add KindSpec to st plugin**

In `packages/core/src/st.ts`, add the import and replace `kinds: {}`:
```typescript
import type { KindSpec } from "./registry";

// Replace kinds: {} with:
kinds: {
  "st/let": { inputs: [undefined as unknown, "" as string], output: undefined as unknown } as KindSpec<[unknown, string], unknown>,
  "st/get": { inputs: ["" as string], output: undefined as unknown } as KindSpec<[string], unknown>,
  "st/set": { inputs: ["" as string, undefined as unknown], output: undefined as unknown } as KindSpec<[string, unknown], unknown>,
  "st/push": { inputs: ["" as string, undefined as unknown], output: undefined as unknown } as KindSpec<[string, unknown], unknown>,
},
```

Delete the `nodeKinds` line.

**Step 2: Add KindSpec to control plugin**

In `packages/core/src/control.ts`, replace `kinds: {}`:
```typescript
kinds: {
  "control/while": { inputs: [false as boolean, undefined as unknown], output: undefined as unknown } as KindSpec<[boolean, unknown], unknown>,
},
```

Delete the `nodeKinds` line.

**Step 3: Add KindSpec to error plugin**

In `packages/core/src/error.ts`, replace `kinds: {}`:
```typescript
kinds: {
  "error/try": { inputs: [undefined as unknown], output: undefined as unknown } as KindSpec<[unknown], unknown>,
  "error/fail": { inputs: ["" as string], output: undefined as unknown } as KindSpec<[string], unknown>,
  "error/guard": { inputs: [false as boolean, "" as string], output: undefined as unknown } as KindSpec<[boolean, string], unknown>,
  "error/caught": { inputs: [undefined as unknown], output: "" as string } as KindSpec<[unknown], string>,
  "error/attempt": { inputs: [undefined as unknown], output: undefined as unknown } as KindSpec<[unknown], unknown>,
  "error/settle": { inputs: [undefined as unknown], output: undefined as unknown } as KindSpec<[unknown], unknown>,
},
```

Delete the `nodeKinds` line.

**Step 4: Add KindSpec to fiber plugin**

In `packages/core/src/fiber.ts`, replace `kinds: {}`:
```typescript
kinds: {
  "fiber/par_map": { inputs: [] as unknown[], output: [] as unknown[] } as KindSpec<unknown[], unknown[]>,
  "fiber/par_item": { inputs: [undefined as unknown], output: undefined as unknown } as KindSpec<[unknown], unknown>,
  "fiber/race": { inputs: [] as unknown[], output: undefined as unknown } as KindSpec<unknown[], unknown>,
  "fiber/timeout": { inputs: [undefined as unknown, 0 as number], output: undefined as unknown } as KindSpec<[unknown, number], unknown>,
  "fiber/retry": { inputs: [undefined as unknown, 0 as number, 0 as number], output: undefined as unknown } as KindSpec<[unknown, number, number], unknown>,
},
```

Delete the `nodeKinds` line.

**Step 5: Verify internal plugins compile**

Run: `cd packages/core && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30`
Expected: No errors from internal plugin files.

**Step 6: Commit**

```bash
git add packages/core/src/st.ts packages/core/src/control.ts packages/core/src/error.ts packages/core/src/fiber.ts
git commit -m "feat(core): add real KindSpec to st, control, error, fiber plugins (#299)"
```

---

## Task 4: Write type-safety tests for internal plugins

**Files:**
- Create: `packages/core/tests/plugin-type-safety-st.test.ts`
- Create: `packages/core/tests/plugin-type-safety-error.test.ts`

Model after `packages/core/tests/dirty-type-safety.test.ts`. Two categories: construction-time errors and dirty-manipulation errors.

**Step 1: Write st type-safety test**

```typescript
/**
 * Type-safety tests for st plugin — prove that wrong types
 * in construction and dirty manipulation are caught at compile time.
 */
import { describe, it } from "vitest";
import type { DirtyExpr, KindSpec, NodeEntry } from "../src/index";
import { commit, dirty, makeCExpr, rewireChildren, swapEntry } from "../src/index";

// Known adj shape for st type-level tests
type StAdj = {
  c1: NodeEntry<"st/let", ["v1", "id1"], unknown>;
  v1: NodeEntry<"num/literal", [], number>;
  id1: NodeEntry<"str/literal", [], string>;
  g1: NodeEntry<"st/get", ["id1"], unknown>;
};

function makeStDirty(): DirtyExpr<unknown, "c1", StAdj, "c2"> {
  return {
    __id: "c1",
    __adj: {
      c1: { kind: "st/let", children: ["v1", "id1"], out: undefined },
      v1: { kind: "num/literal", children: [], out: 42 },
      id1: { kind: "str/literal", children: [], out: "__cell_0" },
      g1: { kind: "st/get", children: ["id1"], out: undefined },
    },
    __counter: "c2",
  } as unknown as DirtyExpr<unknown, "c1", StAdj, "c2">;
}

describe("st plugin type safety", () => {
  it("swapEntry preserving output type compiles", () => {
    const swapped = swapEntry(makeStDirty(), "v1", {
      kind: "num/add" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing output type is error", () => {
    const swapped = swapEntry(makeStDirty(), "v1", {
      kind: "bool/literal" as const,
      children: [] as [],
      out: true as boolean,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeStDirty(), "v1", "v1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
```

**Step 2: Write error type-safety test**

Similar pattern — pick `error/fail` (output: unknown) and `error/caught` (output: string), prove swapEntry catches mismatches.

**Step 3: Run tests to verify they pass (type-level tests)**

Run: `cd packages/core && npx vitest run tests/plugin-type-safety-st.test.ts tests/plugin-type-safety-error.test.ts`
Expected: All pass (type-level assertions via @ts-expect-error).

**Step 4: Commit**

```bash
git add packages/core/tests/plugin-type-safety-st.test.ts packages/core/tests/plugin-type-safety-error.test.ts
git commit -m "test(core): add type-safety tests for st and error plugins (#299)"
```

---

## Task 5: Port external plugins — mock-based batch (fetch, console, pino, zod)

Each plugin already has a `buildKinds()` that returns `KindSpec<unknown[], unknown>` stubs. Replace with real types and delete `nodeKinds`.

**Files:**
- Modify: `packages/plugin-fetch/src/whatwg/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-console/src/22.0.0/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-pino/src/10.3.1/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-zod/src/index.ts` — real KindSpec, delete nodeKinds

**Step 1: Port fetch plugin kinds**

In `packages/plugin-fetch/src/whatwg/index.ts`, replace `buildKinds()` (lines 122-156) with properly typed KindSpec entries:
```typescript
function buildKinds() {
  return {
    "fetch/request": {
      inputs: ["" as string] as [string, ...unknown[]],
      output: undefined as unknown,
    } as KindSpec<[string, ...unknown[]], unknown>,
    "fetch/json": {
      inputs: [undefined as unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "fetch/text": {
      inputs: [undefined as unknown],
      output: "" as string,
    } as KindSpec<[unknown], string>,
    "fetch/status": {
      inputs: [undefined as unknown],
      output: 0 as number,
    } as KindSpec<[unknown], number>,
    "fetch/headers": {
      inputs: [undefined as unknown],
      output: {} as Record<string, string>,
    } as KindSpec<[unknown], Record<string, string>>,
    "fetch/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "fetch/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}
```

Delete the `nodeKinds: [...NODE_KINDS]` line (line 195). The `NODE_KINDS` const can stay if used elsewhere, or be deleted if only used for `nodeKinds`.

**Step 2: Repeat for console, pino, zod**

Same pattern — replace `buildKinds()` stubs with real types, delete `nodeKinds` lines. For console/pino, most kinds have variadic inputs and void output:
```typescript
"console/log": KindSpec<unknown[], void>
"pino/info": KindSpec<[unknown, ...unknown[]], void>
```

For zod:
```typescript
"zod/parse": KindSpec<[unknown, unknown], unknown>
"zod/safe_parse": KindSpec<[unknown, unknown], { success: boolean; data?: unknown; error?: unknown }>
```

**Step 3: Verify these plugins compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(fetch|console|pino|zod)" | head -20`
Expected: No errors from these plugin files.

**Step 4: Commit**

```bash
git add packages/plugin-fetch/ packages/plugin-console/ packages/plugin-pino/ packages/plugin-zod/
git commit -m "feat(plugins): add real KindSpec to fetch, console, pino, zod (#299)"
```

---

## Task 6: Write type-safety tests for mock-based plugins

**Files:**
- Create: `packages/plugin-fetch/tests/whatwg/type-safety.test.ts`
- Create: `packages/plugin-zod/tests/type-safety.test.ts`

**Step 1: Write fetch type-safety test**

```typescript
import { describe, it } from "vitest";
import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { makeCExpr, dirty, swapEntry, commit } from "@mvfm/core";

type FetchAdj = {
  u1: NodeEntry<"str/literal", [], string>;
  r1: NodeEntry<"fetch/request", ["u1"], unknown>;
  s1: NodeEntry<"fetch/status", ["r1"], number>;
  t1: NodeEntry<"fetch/text", ["r1"], string>;
};

function makeFetchDirty(): DirtyExpr<number, "s1", FetchAdj, "x1"> {
  return {
    __id: "s1",
    __adj: {
      u1: { kind: "str/literal", children: [], out: "https://example.com" },
      r1: { kind: "fetch/request", children: ["u1"], out: undefined },
      s1: { kind: "fetch/status", children: ["r1"], out: 200 },
      t1: { kind: "fetch/text", children: ["r1"], out: "hello" },
    },
    __counter: "x1",
  } as unknown as DirtyExpr<number, "s1", FetchAdj, "x1">;
}

describe("fetch plugin type safety", () => {
  it("swapEntry preserving number output compiles", () => {
    const swapped = swapEntry(makeFetchDirty(), "s1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry number→string is error", () => {
    const swapped = swapEntry(makeFetchDirty(), "s1", {
      kind: "fetch/text" as const,
      children: ["r1"] as ["r1"],
      out: "" as string,
    });
    // @ts-expect-error — SwapTypeError: number ≠ string
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });
});
```

**Step 2: Write zod type-safety test**

Similar pattern — pick `zod/parse` (output: unknown) and `zod/safe_parse` (output: `{success, data?, error?}`), prove swap catches mismatch.

**Step 3: Run tests**

Run: `npx vitest run packages/plugin-fetch/tests/whatwg/type-safety.test.ts packages/plugin-zod/tests/type-safety.test.ts`
Expected: All pass.

**Step 4: Commit**

```bash
git add packages/plugin-fetch/tests/ packages/plugin-zod/tests/
git commit -m "test(plugins): add type-safety tests for fetch and zod (#299)"
```

---

## Task 7: Port external plugins — fixture-based batch (slack, openai, anthropic, fal, stripe, twilio, resend)

**Files:**
- Modify: `packages/plugin-slack/src/7.14.0/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-openai/src/6.21.0/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-anthropic/src/0.74.0/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-fal/src/1.9.1/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-twilio/src/5.5.1/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-resend/src/6.9.2/index.ts` — real KindSpec, delete nodeKinds

**Step 1: Port each plugin**

Same pattern as Task 5. Replace `buildKinds()` stubs with real types. For each plugin, the output types come from the SDK types. Examples:

```typescript
// anthropic
"anthropic/create_message": KindSpec<[unknown], Message>
"anthropic/count_tokens": KindSpec<[unknown], TokenCount>

// openai
"openai/create_chat_completion": KindSpec<[unknown], ChatCompletion>

// stripe
"stripe/create_payment_intent": KindSpec<[unknown], Stripe.PaymentIntent>
"stripe/retrieve_payment_intent": KindSpec<[string], Stripe.PaymentIntent>

// twilio
"twilio/create_message": KindSpec<[unknown], MessageInstance>
"twilio/create_call": KindSpec<[unknown], CallInstance>

// resend
"resend/send_email": KindSpec<[unknown], SendEmailResponse>
```

For slack (generated), update the generator to emit typed KindSpec using `@slack/web-api` types. For the representative subset:
```typescript
"slack/chat.postMessage": KindSpec<[unknown], ChatPostMessageResponse>
"slack/conversations.list": KindSpec<[unknown], ConversationsListResponse>
```

Delete `nodeKinds` from every plugin.

**Step 2: Verify build**

Run: `npx tsc --noEmit 2>&1 | head -30`

**Step 3: Commit**

```bash
git add packages/plugin-slack/ packages/plugin-openai/ packages/plugin-anthropic/ packages/plugin-fal/ packages/plugin-stripe/ packages/plugin-twilio/ packages/plugin-resend/
git commit -m "feat(plugins): add real KindSpec to fixture-based plugins (#299)"
```

---

## Task 8: Write type-safety tests for fixture-based plugins

**Files:**
- Create: `packages/plugin-anthropic/tests/0.74.0/type-safety.test.ts`
- Create: `packages/plugin-stripe/tests/2025-04-30.basil/type-safety.test.ts`

Pick 2 representative plugins (anthropic, stripe). Same dirty-type-safety pattern. Other plugins follow same template.

**Step 1: Write anthropic type-safety test**

Prove `swapEntry` catches mismatch between `anthropic/create_message` (output: Message) and `anthropic/count_tokens` (output: TokenCount).

**Step 2: Write stripe type-safety test**

Prove `swapEntry` catches mismatch between `stripe/create_payment_intent` (output: PaymentIntent) and `stripe/list_customers` (output: Customer[]).

**Step 3: Run tests and commit**

---

## Task 9: Port external plugins — container-based batch (postgres, redis, s3, cloudflare-kv)

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-redis/src/5.4.1/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-redis/src/5.4.1/node-kinds.ts` — may need updating or deletion
- Modify: `packages/plugin-s3/src/3.989.0/index.ts` — real KindSpec, delete nodeKinds
- Modify: `packages/plugin-cloudflare-kv/src/4.20260213.0/index.ts` — real KindSpec, delete nodeKinds

**Step 1: Port postgres plugin kinds**

Replace `buildKinds()` with real types:
```typescript
function buildKinds() {
  return {
    "postgres/query": {
      inputs: [0 as number, ...[] as string[], ...[] as unknown[]] as [number, ...string[], ...unknown[]],
      output: [] as unknown[],
    } as KindSpec<[number, ...string[], ...unknown[]], unknown[]>,
    "postgres/identifier": {
      inputs: [undefined as unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "postgres/insert_helper": {
      inputs: [undefined as unknown, "" as string],
      output: undefined as unknown,
    } as KindSpec<[unknown, string], unknown>,
    "postgres/set_helper": {
      inputs: [undefined as unknown, "" as string],
      output: undefined as unknown,
    } as KindSpec<[unknown, string], unknown>,
    "postgres/begin": {
      inputs: ["" as string, ...[] as unknown[]] as [string, ...unknown[]],
      output: undefined as unknown,
    } as KindSpec<[string, ...unknown[]], unknown>,
    "postgres/savepoint": {
      inputs: ["" as string, ...[] as unknown[]] as [string, ...unknown[]],
      output: undefined as unknown,
    } as KindSpec<[string, ...unknown[]], unknown>,
    "postgres/cursor": {
      inputs: [undefined as unknown, undefined as unknown, undefined as unknown],
      output: undefined as void,
    } as KindSpec<[unknown, unknown, unknown], void>,
    "postgres/cursor_batch": {
      inputs: [] as [],
      output: [] as unknown[],
    } as KindSpec<[], unknown[]>,
    "postgres/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "postgres/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}
```

Delete `nodeKinds: [...NODE_KINDS]`.

**Step 2: Port redis plugin kinds**

Representative subset with real types:
```typescript
"redis/get": KindSpec<[string], string | null>
"redis/set": KindSpec<[string, string], string>
"redis/incr": KindSpec<[string], number>
"redis/incrby": KindSpec<[string, number], number>
"redis/del": KindSpec<[...string[]], number>
"redis/hget": KindSpec<[string, string], string | null>
"redis/hset": KindSpec<[string, string, string], number>
"redis/lpush": KindSpec<[string, ...unknown[]], number>
// ... all 40 kinds need real types
```

Delete `nodeKinds` and the `node-kinds.ts` file if it only existed for `nodeKinds`.

**Step 3: Port s3 and cloudflare-kv similarly**

```typescript
// s3
"s3/put_object": KindSpec<[unknown], PutObjectOutput>
"s3/get_object": KindSpec<[unknown], GetObjectOutput>
"s3/list_objects_v2": KindSpec<[unknown], ListObjectsV2Output>

// cloudflare-kv
"cloudflare-kv/get": KindSpec<[string], string | null>
"cloudflare-kv/put": KindSpec<[string, string], void>
"cloudflare-kv/delete": KindSpec<[string], void>
"cloudflare-kv/list": KindSpec<[unknown], KVListResult>
```

**Step 4: Verify and commit**

```bash
git add packages/plugin-postgres/ packages/plugin-redis/ packages/plugin-s3/ packages/plugin-cloudflare-kv/
git commit -m "feat(plugins): add real KindSpec to container-based plugins (#299)"
```

---

## Task 10: Write type-safety tests for container-based plugins

**Files:**
- Create: `packages/plugin-postgres/tests/3.4.8/type-safety.test.ts`
- Create: `packages/plugin-redis/tests/5.4.1/type-safety.test.ts`

**Step 1: Write postgres type-safety test**

Prove swapEntry catches mismatch between `postgres/query` (output: unknown[]) and `postgres/cursor` (output: void).

**Step 2: Write redis type-safety test**

Prove swapEntry catches mismatch between `redis/get` (output: string | null) and `redis/incr` (output: number).

**Step 3: Run tests and commit**

---

## Task 11: Write end-to-end integration tests (representative plugins)

**Files:**
- Create: `packages/plugin-fetch/tests/whatwg/everything.test.ts`
- Create: `packages/plugin-zod/tests/everything.test.ts`
- Create: `packages/plugin-postgres/tests/3.4.8/everything.test.ts`
- Create: `packages/plugin-redis/tests/5.4.1/everything.test.ts`

**Step 1: Write fetch end-to-end test**

Uses a mock fetch implementation. Exercises: request, json, text, status, headers.
```typescript
import { describe, expect, test } from "vitest";
import { defaults, fold, mvfm, prelude } from "@mvfm/core";
import { fetchPlugin } from "../src/whatwg/index";

describe("fetch everything", () => {
  test("request → json → status pipeline", async () => {
    const app = mvfm(prelude, fetchPlugin({ baseUrl: "https://example.com" }));
    const prog = app({}, ($) => {
      const resp = $.fetch("/api/data");
      return {
        data: $.fetch.json(resp),
        status: $.fetch.status(resp),
      };
    });
    // Uses mocked fetch or intercepted requests
    const result = await fold(defaults(app), prog);
    expect(result).toEqual({ data: expect.any(Object), status: 200 });
  });
});
```

**Step 2: Write postgres end-to-end test (testcontainer)**

Uses testcontainer postgres. Exercises: query, insert_helper, begin.

**Step 3: Write redis end-to-end test (testcontainer)**

Uses testcontainer redis. Exercises: get, set, incr, hget, hset.

**Step 4: Write zod end-to-end test (pure)**

No infra needed. Exercises: parse, safe_parse.

**Step 5: Run all tests and commit**

```bash
npx vitest run
git add .
git commit -m "test(plugins): add end-to-end integration tests (#299)"
```

---

## Task 12: Cleanup and verification

**Files:**
- Modify: `docs/plugin-authoring-guide.md` — update contract to require `kinds` instead of `nodeKinds`
- Modify: `packages/core/src/index.ts` — verify no `nodeKinds` re-exports

**Step 1: Verify zero nodeKinds references**

Run: `grep -r "nodeKinds" packages/ scripts/ --include="*.ts" -l`
Expected: Empty output.

**Step 2: Full validation**

Run: `npm run build && npm run check && npm test`
Expected: All pass.

**Step 3: Update plugin authoring guide**

In `docs/plugin-authoring-guide.md`, replace references to `nodeKinds` with `kinds`. The contract becomes: `name`, `kinds`, `build(ctx)` (or the unified Plugin shape).

**Step 4: Commit**

```bash
git add docs/plugin-authoring-guide.md
git commit -m "docs: update plugin authoring guide for kinds-only contract (#299)"
```

---

## Parallelization Notes

- **Tasks 1-4** are sequential (core changes gate everything)
- **Tasks 5-6** (mock-based), **7-8** (fixture-based), **9-10** (container-based) are **independent** and can run in parallel
- **Task 11** (end-to-end tests) depends on kinds being ported but can overlap with type-safety test writing
- **Task 12** (cleanup) runs last
