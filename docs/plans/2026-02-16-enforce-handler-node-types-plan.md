# Enforce Handler Node Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `NodeTypeMap` registry so `CompleteInterpreter<K>` enforces handler node types at compile time for registered kinds, with `any` fallback for unregistered kinds.

**Architecture:** Declaration-merged `NodeTypeMap` interface in `fold.ts`. `CompleteInterpreter<K>` maps registered kinds through `Handler<NodeTypeMap[key]>`, unregistered kinds fall back to `(node: any) => ...`. Plugins augment `NodeTypeMap` alongside their typed node interfaces.

**Tech Stack:** TypeScript (declaration merging, mapped types, module augmentation)

---

### Task 1: Spike — validate type machinery

**Files:**
- Create: `packages/core/src/__spike_node_type_map.ts` (temporary, deleted after validation)

**Step 1: Write the spike file**

This file must compile with `tsc --noEmit`. It tests all 7 spike criteria from the design doc.

```ts
// Spike: validate NodeTypeMap + CompleteInterpreter type machinery
// This file is deleted after validation. Do NOT commit.

import type { TypedNode, FoldYield } from "./fold";

// --- Simulate the registry ---

interface SpikeNodeTypeMap {}

type SpikeHandler<N extends TypedNode<any>> =
  N extends TypedNode<infer T> ? (node: N) => AsyncGenerator<FoldYield, T, unknown> : never;

type SpikeCompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof SpikeNodeTypeMap
    ? SpikeHandler<SpikeNodeTypeMap[key]>
    : (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
};

// --- Simulate two plugins augmenting the registry ---

interface AlphaNode extends TypedNode<string> {
  kind: "alpha/op";
  value: string;
}

interface BetaNode extends TypedNode<number> {
  kind: "beta/op";
  count: TypedNode<number>;
}

// Module augmentation simulation (same-file for spike; real impl uses declare module)
interface SpikeNodeTypeMap {
  "alpha/op": AlphaNode;
  "beta/op": BetaNode;
}

// --- Criterion 1: Declaration merging works ---
// SpikeNodeTypeMap now has both keys. If this type resolves, merging works.
type _Check1A = SpikeNodeTypeMap["alpha/op"]; // AlphaNode
type _Check1B = SpikeNodeTypeMap["beta/op"];  // BetaNode

// --- Criterion 2: Rejects node: any for registered kind ---
// @ts-expect-error: 'any' handler should not satisfy Handler<AlphaNode>
const _bad1: SpikeCompleteInterpreter<"alpha/op"> = {
  "alpha/op": async function* (node: any) { return ""; }
};

// --- Criterion 3: Rejects wrong node type ---
// @ts-expect-error: BetaNode handler should not satisfy Handler<AlphaNode>
const _bad2: SpikeCompleteInterpreter<"alpha/op"> = {
  "alpha/op": async function* (node: BetaNode) { return ""; }
};

// --- Criterion 4: Accepts correct node type ---
const _good1: SpikeCompleteInterpreter<"alpha/op"> = {
  // biome-ignore lint/correctness/useYield: spike test
  "alpha/op": async function* (node: AlphaNode) { return node.value; }
};

// --- Criterion 5: Spread composition works ---
const _interpA: SpikeCompleteInterpreter<"alpha/op"> = {
  // biome-ignore lint/correctness/useYield: spike test
  "alpha/op": async function* (node: AlphaNode) { return node.value; }
};
const _interpB: SpikeCompleteInterpreter<"beta/op"> = {
  "beta/op": async function* (node: BetaNode) { return yield node.count; }
};
const _composed: SpikeCompleteInterpreter<"alpha/op" | "beta/op"> = {
  ..._interpA,
  ..._interpB,
};

// --- Criterion 6: Handler return type flows through phantom T ---
// AlphaNode extends TypedNode<string>, so Handler<AlphaNode> returns string.
// @ts-expect-error: returning number should fail for Handler<AlphaNode>
const _bad3: SpikeCompleteInterpreter<"alpha/op"> = {
  // biome-ignore lint/correctness/useYield: spike test
  "alpha/op": async function* (node: AlphaNode) { return 42; }
};

// --- Criterion 7: Unregistered kind gets any fallback ---
const _unregistered: SpikeCompleteInterpreter<"gamma/unknown"> = {
  // biome-ignore lint/correctness/useYield: spike test
  "gamma/unknown": async function* (node: any) { return "anything"; }
};
```

**Step 2: Run the spike**

Run: `cd packages/core && npx tsc --noEmit --project tsconfig.json`
Expected: Compiles with 0 errors (the `@ts-expect-error` lines suppress the expected errors; if the type machinery doesn't work, those lines become "unused @ts-expect-error" which IS an error).

**Hard-stop check:** If criteria 1, 2, or 5 fail, STOP. Report back — the approach needs rethinking.

**Step 3: Delete the spike file**

```bash
rm packages/core/src/__spike_node_type_map.ts
```

**Step 4: Commit (spike validated)**

```bash
git add -A && git commit -m "chore: spike validates NodeTypeMap type machinery (#197)"
```

Wait — actually don't commit a deletion. Just delete the file and move on. The spike is throwaway.

---

### Task 2: Add NodeTypeMap and update CompleteInterpreter

**Files:**
- Modify: `packages/core/src/fold.ts` (add `NodeTypeMap`, update `CompleteInterpreter`)
- Modify: `packages/core/src/index.ts` (re-export `NodeTypeMap`)

**Step 1: Add NodeTypeMap interface to fold.ts**

Add after the `Handler` type (after line 60):

```ts
/**
 * Global registry mapping node kind strings to their typed node interfaces.
 * Plugins extend this via declaration merging (module augmentation).
 *
 * @example
 * ```ts
 * declare module "@mvfm/core" {
 *   interface NodeTypeMap {
 *     "myplugin/op": MyOpNode;
 *   }
 * }
 * ```
 */
export interface NodeTypeMap {}
```

**Step 2: Update CompleteInterpreter**

Replace the existing `CompleteInterpreter` type (lines 274-276):

```ts
/**
 * Complete interpreter type: must have a handler for every kind `K`.
 * Registered kinds (in {@link NodeTypeMap}) get full type checking via
 * {@link Handler}. Unregistered kinds fall back to `(node: any)`.
 */
export type CompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof NodeTypeMap
    ? Handler<NodeTypeMap[key]>
    : (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
};
```

**Step 3: Re-export NodeTypeMap from index.ts**

Add `NodeTypeMap` to the type export list in `packages/core/src/index.ts`:

```ts
export type {
  CompleteInterpreter,
  FoldState,
  FoldYield,
  Handler,
  Interpreter,
  NodeTypeMap,
  RecurseScopedEffect,
  ScopedBinding,
  TypedNode,
  TypedProgram,
} from "./fold";
```

**Step 4: Verify build**

Run: `pnpm run build`
Expected: Clean build. No existing code should break since `NodeTypeMap` is empty (all kinds fall through to `any` fallback).

**Step 5: Commit**

```bash
git add packages/core/src/fold.ts packages/core/src/index.ts
git commit -m "feat(core): add NodeTypeMap registry and typed CompleteInterpreter (#197)"
```

---

### Task 3: Register core interpreter node types

**Files:**
- Modify: `packages/core/src/interpreters/core.ts` (add NodeTypeMap augmentation, export interfaces)

**Step 1: Export the node interfaces and add augmentation**

The interfaces are already defined in `core.ts` (lines 6-53) but are not exported. Add `export` to each interface, then add the module augmentation block after the interfaces:

```ts
export interface CoreLiteral<T = unknown> extends TypedNode<T> { ... }
export interface CoreInput extends TypedNode<unknown> { ... }
export interface CorePropAccess<T = unknown> extends TypedNode<T> { ... }
export interface CoreRecord extends TypedNode<Record<string, unknown>> { ... }
export interface CoreCond<T = unknown> extends TypedNode<T> { ... }
export interface CoreBegin<T = unknown> extends TypedNode<T> { ... }
export interface CoreProgram extends TypedNode<unknown> { ... }
export interface CoreTuple extends TypedNode<unknown[]> { ... }
export interface CoreLambdaParam<T = unknown> extends TypedNode<T> { ... }

declare module "../fold" {
  interface NodeTypeMap {
    "core/literal": CoreLiteral;
    "core/input": CoreInput;
    "core/prop_access": CorePropAccess;
    "core/record": CoreRecord;
    "core/cond": CoreCond;
    "core/begin": CoreBegin;
    "core/program": CoreProgram;
    "core/tuple": CoreTuple;
    "core/lambda_param": CoreLambdaParam;
  }
}
```

Note: Core is in the same package as `fold.ts`, so it uses `declare module "../fold"` not `declare module "@mvfm/core"`.

**Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build. The core handlers already use typed signatures (`node: CoreLiteral`, etc.) so they should satisfy `Handler<NodeTypeMap["core/literal"]>`.

If any handler fails type checking, it means there's a type mismatch between the handler's actual signature and what `Handler<N>` expects. Fix the handler signature — these are real bugs.

**Step 3: Commit**

```bash
git add packages/core/src/interpreters/core.ts
git commit -m "feat(core): register core node types in NodeTypeMap (#197)"
```

---

### Task 4: Register redis node types

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts` (export interfaces, add augmentation)

**Step 1: Export interfaces and add augmentation**

The 35 node interfaces are already defined (lines 27-182) but are not exported. Add `export` to each, then add the augmentation block:

```ts
export interface RedisKeyNode<K extends string, T> extends TypedNode<T> { ... }
export interface RedisKeysNode<K extends string, T> extends TypedNode<T> { ... }
// ... (all 35+ interfaces)

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "redis/get": RedisGetNode;
    "redis/set": RedisSetNode;
    "redis/incr": RedisIncrNode;
    "redis/incrby": RedisIncrByNode;
    "redis/decr": RedisDecrNode;
    "redis/decrby": RedisDecrByNode;
    "redis/mget": RedisMGetNode;
    "redis/mset": RedisMSetNode;
    "redis/append": RedisAppendNode;
    "redis/getrange": RedisGetRangeNode;
    "redis/setrange": RedisSetRangeNode;
    "redis/del": RedisDelNode;
    "redis/exists": RedisExistsNode;
    "redis/expire": RedisExpireNode;
    "redis/pexpire": RedisPExpireNode;
    "redis/ttl": RedisTTLNode;
    "redis/pttl": RedisPTTLNode;
    "redis/hget": RedisHGetNode;
    "redis/hset": RedisHSetNode;
    "redis/hmget": RedisHMGetNode;
    "redis/hgetall": RedisHGetAllNode;
    "redis/hdel": RedisHDelNode;
    "redis/hexists": RedisHExistsNode;
    "redis/hlen": RedisHLenNode;
    "redis/hkeys": RedisHKeysNode;
    "redis/hvals": RedisHValsNode;
    "redis/hincrby": RedisHIncrByNode;
    "redis/lpush": RedisLPushNode;
    "redis/rpush": RedisRPushNode;
    "redis/lpop": RedisLPopNode;
    "redis/rpop": RedisRPopNode;
    "redis/llen": RedisLLenNode;
    "redis/lrange": RedisLRangeNode;
    "redis/lindex": RedisLIndexNode;
    "redis/lset": RedisLSetNode;
    "redis/lrem": RedisLRemNode;
    "redis/linsert": RedisLInsertNode;
  }
}
```

**Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build. Redis handlers already use typed signatures.

Fix any type mismatches — they're real bugs.

**Step 3: Commit**

```bash
git add packages/plugin-redis/src/5.4.1/interpreter.ts
git commit -m "feat(plugin-redis): register redis node types in NodeTypeMap (#197)"
```

---

### Task 5: Register postgres node types

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/interpreter.ts` (add augmentation — interfaces are already exported)

**Step 1: Add augmentation block**

The postgres interfaces are already exported (lines 35-95). Add the augmentation:

```ts
declare module "@mvfm/core" {
  interface NodeTypeMap {
    "postgres/query": PostgresQueryNode;
    "postgres/identifier": PostgresIdentifierNode;
    "postgres/insert_helper": PostgresInsertHelperNode;
    "postgres/set_helper": PostgresSetHelperNode;
    "postgres/begin": PostgresBeginNode;
    "postgres/savepoint": PostgresSavepointNode;
    "postgres/cursor": PostgresCursorNode;
    "postgres/cursor_batch": PostgresCursorBatchNode;
  }
}
```

**Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build. Postgres handlers already use typed signatures.

Note: The `postgres/identifier`, `postgres/insert_helper`, and `postgres/set_helper` handlers don't take typed node params (they're stub throwers at lines 207-225). These will need their signatures updated to match `Handler<NodeTypeMap[key]>`. For example:

```ts
// biome-ignore lint/correctness/useYield: stub throws before yielding
"postgres/identifier": async function* (_node: PostgresIdentifierNode) {
  throw new Error("...");
},
```

**Step 3: Commit**

```bash
git add packages/plugin-postgres/src/3.4.8/interpreter.ts
git commit -m "feat(plugin-postgres): register postgres node types in NodeTypeMap (#197)"
```

---

### Task 6: Add compile-time type tests

**Files:**
- Create: `packages/core/src/__tests__/node-type-map.type-test.ts`

**Step 1: Write the type tests**

```ts
/**
 * Compile-time tests for NodeTypeMap + CompleteInterpreter type enforcement.
 * These are checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 */

import type { CompleteInterpreter } from "../fold";
import type { CoreLiteral, CoreInput } from "../interpreters/core";

// --- Positive: correct handler compiles ---

const _correctHandler: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};

// --- Positive: spread composition compiles ---

const _litInterp: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};
const _inputInterp: CompleteInterpreter<"core/input"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },
};
const _composed: CompleteInterpreter<"core/literal" | "core/input"> = {
  ..._litInterp,
  ..._inputInterp,
};

// --- Negative: node: any rejected for registered kind ---

// @ts-expect-error handler with node:any should not satisfy Handler<CoreLiteral>
const _badAny: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node.value;
  },
};

// --- Negative: wrong node type rejected ---

// @ts-expect-error CoreInput should not satisfy Handler<CoreLiteral>
const _badWrongType: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
};

// --- Negative: wrong return type rejected ---

// @ts-expect-error returning number should fail for Handler<CoreLiteral<unknown>>
const _badReturn: CompleteInterpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return 42;
  },
};

// --- Unregistered kind: any fallback (temporary, until all plugins register) ---

const _unregistered: CompleteInterpreter<"unregistered/kind"> = {
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
};
```

**Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build. All `@ts-expect-error` lines should suppress real errors.

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass (type test file has no runtime tests, but verify nothing else broke).

**Step 4: Commit**

```bash
git add packages/core/src/__tests__/node-type-map.type-test.ts
git commit -m "test(core): add compile-time type tests for NodeTypeMap (#197)"
```

---

### Task 7: File follow-up issues

**Files:** None (GitHub API only)

**Step 1: Create per-plugin issues**

Create one issue per untyped plugin group. Each issue should:
- Title: "Add typed node interfaces for `<plugin>` and register in NodeTypeMap"
- Body: List the node kinds that need interfaces, reference #197
- Label: `ready`
- Milestone: "Phase 1: Core Solidification"

Plugins to file for:
1. `error` (5 kinds: error/try, error/fail, error/attempt, error/guard, error/settle)
2. `fiber` (4 kinds: fiber/par_map, fiber/race, fiber/timeout, fiber/retry)
3. `control` (2 kinds: control/each, control/while)
4. `boolean` (10 kinds)
5. `num` (19 kinds)
6. `str` (17 kinds)
7. `eq` (1 kind: eq/neq)
8. `ord` (4 kinds: ord/gt, ord/gte, ord/lt, ord/lte)
9. `fetch` (5 kinds)
10. `anthropic` (9 kinds)
11. `openai` (8 kinds)
12. `s3` (5 kinds)
13. `slack` (26 kinds)
14. `stripe` (10 kinds)
15. `resend` (7 kinds)
16. `pino` (6 kinds)
17. `cloudflare-kv` (5 kinds)
18. `fal` (6 kinds)
19. `twilio` (6 kinds)

Some of these can be grouped (e.g. all core prelude plugins in one issue, all messaging plugins in one) — use judgment to keep the issue count reasonable.

**Step 2: Create the "flip to never" issue**

Title: "Remove `any` fallback from CompleteInterpreter — enforce NodeTypeMap for all kinds"
Body: "Once all plugins have typed node interfaces registered in NodeTypeMap, change the fallback branch in `CompleteInterpreter` from `(node: any) => ...` to `never`. This makes unregistered kinds a compile error. Blocked by: [list all per-plugin issues]."
Label: `ready`
Milestone: "Phase 1: Core Solidification"

**Step 3: Commit (nothing to commit — issues only)**

---

### Task 8: Final validation

**Step 1: Full build + check + test**

Run: `pnpm run build && pnpm run check && pnpm run test`
Expected: All green.

**Step 2: Verify the type enforcement works end-to-end**

Temporarily add a bad handler in a test file to confirm tsc catches it, then remove it. This is a manual sanity check — the type tests in Task 6 cover this permanently.
