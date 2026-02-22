# Issue #291: Port External Plugins to Unified Plugin Type

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite all 16 external plugin packages from the old `definePlugin`/`build(ctx)`/`TypedNode`/`eval_()` API to the new unified `Plugin` type with `ctors`/`kinds`/`nodeKinds`/`defaultInterpreter` and index-based fold handlers.

**Architecture:** Each plugin becomes a `Plugin`-shaped object (or factory returning one). Constructors use `makeCExpr(kind, [...children])` for positional child references. Interpreters use `yield N` for positional child access and `entry.out` for stored leaf values. Config is captured in the interpreter closure, not stored on AST nodes. The `handler.client.ts` and `handler.server.ts` files are ported to use the new `fold()` API instead of `foldAST()`.

**Tech Stack:** TypeScript, vitest, `@mvfm/core` unified Plugin API

**Base branch:** `issue-293-opus-0`

---

## Key Porting Patterns

### Old → New Constructor Pattern

```ts
// OLD: ctx.expr() with named fields
build(ctx: PluginContext) {
  return {
    myPlugin: {
      op(url: Expr<string>, init?: Expr<T>): Expr<R> {
        return ctx.expr({ kind: "myPlugin/op", url: ctx.lift(url).__node, init: init?.__node ?? null, config });
      }
    }
  };
}

// NEW: makeCExpr() with positional args
ctors: {
  myPlugin: {
    op: <A, B>(url: A, init?: B): CExpr<R, "myPlugin/op", [A] | [A, B]> =>
      init != null
        ? makeCExpr("myPlugin/op", [url, init])
        : makeCExpr("myPlugin/op", [url]),
  }
}
```

### Old → New Interpreter Pattern

```ts
// OLD: TypedNode with named fields + eval_()
"myPlugin/op": async function* (node: MyOpNode) {
  const url = yield* eval_(node.url);
  const init = node.init != null ? yield* eval_(node.init) : undefined;
  return await client.doOp(url, init);
}

// NEW: RuntimeEntry with positional yield
"myPlugin/op": async function* (entry) {
  const url = yield 0;
  const init = entry.children.length > 1 ? yield 1 : undefined;
  return await client.doOp(url as string, init);
}
```

### Config Handling

Config is NO LONGER stored on AST nodes. Instead, config is captured in the interpreter closure:

```ts
// OLD: config baked into every node
ctx.expr({ kind: "x/op", input: node, config: { region: "us-east-1" } })
// interpreter reads: node.config.region

// NEW: config captured in closure
export function createMyPlugin(config: MyConfig): Plugin { ... }
// defaultInterpreter captures config via closure
defaultInterpreter: () => createMyInterpreter(config),
```

### handler.client.ts Pattern (identical for all plugins)

```ts
// NEW: positional children instead of named field walking
export function clientInterpreter(options: ClientHandlerOptions, nodeKinds: string[]): Interpreter {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;
  let stepIndex = 0;
  const interp: Interpreter = {};
  for (const kind of nodeKinds) {
    interp[kind] = async function* (entry) {
      const resolved: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        resolved.push(yield i);
      }
      const response = await fetchFn(`${baseUrl}/mvfm/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ contractHash, stepIndex: stepIndex++, kind, data: resolved, out: entry.out }),
      });
      if (!response.ok) throw new Error(`Client handler: server returned ${response.status}: ${await response.text()}`);
      return ((await response.json()) as { result: unknown }).result;
    };
  }
  return interp;
}
```

### handler.server.ts Pattern

```ts
// NEW: fold() instead of foldAST()
import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { fold } from "@mvfm/core";

export function serverInterpreter(client: MyClient): Interpreter {
  return createMyInterpreter(client);
}

export function serverEvaluate(
  client: MyClient,
  baseInterpreter: Interpreter,
): (rootId: string, adj: Record<string, RuntimeEntry>) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createMyInterpreter(client) };
  return (rootId, adj) => fold(rootId, adj, interp);
}
```

### Test Pattern

```ts
// OLD
const app = mvfm(num, str, myPlugin(config));
const prog = app(($) => $.myPlugin.op("value"));
const result = await foldAST(combined, injected);

// NEW
import { createApp, defaults, fold, makeCExpr } from "@mvfm/core";
import { myPluginU } from "../../src";

const $ = mvfmU(numPluginU, strPluginU, myPluginU);
const appFn = createApp(numPluginU, strPluginU, myPluginU);
// Direct CExpr → NExpr → fold
const nexpr = appFn($.myPlugin.op("value"));
const interp = defaults([numPluginU, strPluginU, myPluginU]);
const result = await fold(nexpr, interp);
```

### Kind registration

External plugins MUST register their kinds in the `kinds` map so `createApp()` / `elaborate` can validate children:

```ts
kinds: {
  "myPlugin/op": { inputs: [0 as unknown], output: undefined as MyResult } as KindSpec<[unknown], MyResult>,
}
```

For nodes with variadic children (like `console/*` methods that take `...args`), use a 0-length inputs array and skip validation:

```ts
kinds: {
  "console/log": { inputs: [] as unknown[], output: undefined as void } as KindSpec<unknown[], void>,
}
```

---

## Task Execution Order

### Phase 1: Shared Infrastructure
1. Create branch and update handler patterns

### Phase 2: Simple Plugins (parallel-safe, independent)
2. plugin-console
3. plugin-fetch
4. plugin-pino
5. plugin-resend
6. plugin-s3
7. plugin-cloudflare-kv

### Phase 3: Medium Plugins (parallel-safe, independent)
8. plugin-openai
9. plugin-anthropic
10. plugin-fal
11. plugin-stripe
12. plugin-twilio

### Phase 4: Complex Plugins
13. plugin-redis
14. plugin-postgres
15. plugin-slack (codegen update)
16. plugin-zod

### Phase 5: Validation
17. Full build/check/test across all packages

---

## Task 1: Create Branch and Verify Base

**Files:**
- None modified yet

**Step 1: Create branch off issue-293-opus-0**

```bash
git checkout issue-293-opus-0
git checkout -b issue-291
```

**Step 2: Verify the base builds**

```bash
npm run build && npm run check && npm test
```

Expected: All passing on the base branch.

**Step 3: Commit (empty, just to mark the branch point)**

No commit needed — the branch is created.

---

## Task 2: Port plugin-console

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/index.ts`
- Modify: `packages/plugin-console/src/22.0.0/interpreter.ts`
- Modify: `packages/plugin-console/src/22.0.0/handler.client.ts`
- Modify: `packages/plugin-console/src/22.0.0/handler.server.ts`
- Modify: `packages/plugin-console/src/index.ts`
- Modify: `packages/plugin-console/tests/22.0.0/index.test.ts`
- Modify: `packages/plugin-console/tests/22.0.0/interpreter.test.ts`
- Test: `packages/plugin-console/tests/22.0.0/integration.test.ts`

**Step 1: Rewrite `index.ts` — replace definePlugin with Plugin object**

The console plugin has 20 methods that all follow the same pattern: variadic args, returns void. The constructor for each creates a CExpr with all args as children. Config is captured in the interpreter closure.

Key change: `console(config?)` returns a `Plugin` instead of `definePlugin(...)`.

Constructor pattern for all 20 methods:
```ts
import { type CExpr, makeCExpr } from "@mvfm/core";

// Each method: (...args: unknown[]) => CExpr<void, "console/METHOD", unknown[]>
const makeMethod = (method: string) =>
  (...args: unknown[]): CExpr<void> => makeCExpr(`console/${method}` as any, args);
```

The `kinds` map has one entry per method, all with variadic unknown inputs and void output.

**Step 2: Rewrite `interpreter.ts` — use positional yield**

Remove: `TypedNode`, `eval_`, `defineInterpreter`, `NodeTypeMap` module augmentation, all typed node interfaces.

New handler pattern:
```ts
const handler = async function* (entry: RuntimeEntry) {
  const method = entry.kind.slice("console/".length) as ConsoleMethodName;
  const args: unknown[] = [];
  for (let i = 0; i < entry.children.length; i++) {
    args.push(yield i);
  }
  await client.call(method, args);
  return undefined;
};
```

**Step 3: Rewrite `handler.client.ts` — positional children**

Replace `TypedNode`/`eval_`/`defineInterpreter` with `RuntimeEntry` and positional `yield i`.

**Step 4: Rewrite `handler.server.ts` — fold() instead of foldAST()**

Replace `foldAST` import with `fold`. Update `serverEvaluate` signature to use `(rootId, adj)` instead of `(root: TypedNode)`.

**Step 5: Update `src/index.ts` re-exports**

Ensure the barrel file exports the new `Plugin`-typed plugin and the new `createConsoleInterpreter`.

**Step 6: Rewrite tests**

- `index.test.ts`: Use `mvfmU()` + `createApp()` instead of old `mvfm()`. Test that CExprs have correct `__kind` and `__args` structure.
- `interpreter.test.ts`: Use `createApp()` + `fold()` + `defaults()` instead of `foldAST`/`coreInterpreter`/`injectInput`.

**Step 7: Run tests**

```bash
cd packages/plugin-console && npx vitest run
```

**Step 8: Commit**

```bash
git add packages/plugin-console/
git commit -m "feat(plugin-console): port to unified Plugin type and index-based fold"
```

---

## Task 3: Port plugin-fetch

**Files:**
- Modify: `packages/plugin-fetch/src/whatwg/index.ts`
- Modify: `packages/plugin-fetch/src/whatwg/interpreter.ts`
- Modify: `packages/plugin-fetch/src/whatwg/handler.client.ts`
- Modify: `packages/plugin-fetch/src/whatwg/handler.server.ts`
- Modify: `packages/plugin-fetch/src/index.ts`
- Modify: `packages/plugin-fetch/tests/whatwg/*.test.ts`

**Porting notes:**

The fetch plugin has 5 node kinds with varying child counts:
- `fetch/request`: children = [url] or [url, init]. Config (baseUrl, defaultHeaders) moves to interpreter closure.
- `fetch/json`, `fetch/text`, `fetch/status`, `fetch/headers`: children = [response].

Constructor for the callable `$.fetch(url, init?)` pattern:
```ts
ctors: {
  fetch: Object.assign(
    <A, B>(url: A, init?: B) => init != null
      ? makeCExpr("fetch/request", [url, init])
      : makeCExpr("fetch/request", [url]),
    {
      json: <A>(response: A) => makeCExpr("fetch/json", [response]),
      text: <A>(response: A) => makeCExpr("fetch/text", [response]),
      status: <A>(response: A) => makeCExpr("fetch/status", [response]),
      headers: <A>(response: A) => makeCExpr("fetch/headers", [response]),
    }
  ),
}
```

Interpreter pattern:
```ts
"fetch/request": async function* (entry) {
  const url = (yield 0) as string;
  const init = entry.children.length > 1 ? (yield 1) as RequestInit : undefined;
  // config.baseUrl and config.defaultHeaders from closure
  ...
}
```

**Steps:** Same as Task 2 (rewrite index, interpreter, handlers, tests, run, commit).

---

## Task 4: Port plugin-pino

**Files:** Same pattern as above under `packages/plugin-pino/src/10.3.1/`

**Porting notes:**

6 node kinds (trace, debug, info, warn, error, fatal). All follow the same pattern with children = [msg?] or [mergeObject?, msg?] or [bindings..., msg?]. The `lazyInterpreter()` pattern (Proxy that defers factory invocation) remains — just rewrite handlers inside it to use positional yield.

Config captured in interpreter closure. No `defaultInterpreter` stored on node.

---

## Task 5: Port plugin-resend

**Files:** Same pattern under `packages/plugin-resend/src/6.9.2/`

**Porting notes:**

7 node kinds. Standard REST-like pattern: each method takes `params` as a single child.
- `resend/send_email`: children = [params]
- `resend/send_batch`: children = [emails] (the old code builds a `core/tuple` for arrays — in the new model, just pass the array as a single CExpr child)
- `resend/create_contact`, `get_contact`, `list_contacts`, `remove_contact`: children = [params] or [id]

Has `defaultInterpreter` via lazy pattern.

---

## Task 6: Port plugin-s3

**Files:** Same pattern under `packages/plugin-s3/src/3.989.0/`

**Porting notes:**

5 node kinds, no `defaultInterpreter`. Each method takes a single `input` child.
- Config (region, credentials, endpoint) captured in interpreter closure.
- `createS3Interpreter(client)` returns `Interpreter` (no change to client adapter).

---

## Task 7: Port plugin-cloudflare-kv

**Files:** Same pattern under `packages/plugin-cloudflare-kv/src/4.20260213.0/`

**Porting notes:**

5 node kinds, no `defaultInterpreter`.
- `kv/get`: children = [key]
- `kv/get_json`: children = [key]
- `kv/put`: children = [key, value] or [key, value, options]
- `kv/delete`: children = [key]
- `kv/list`: children = [] or [options]

The `get` overload (string type vs json) is resolved at construction time (different node kinds).

---

## Task 8: Port plugin-openai

**Files:** Same pattern under `packages/plugin-openai/src/6.21.0/`

**Porting notes:**

8 node kinds with nested namespace: `$.openai.chat.completions.create(params)`. Each method takes a single `params` child or `id` child.

Constructor returns nested object in `ctors`:
```ts
ctors: {
  openai: {
    chat: {
      completions: {
        create: (params) => makeCExpr("openai/create_chat_completion", [params]),
        retrieve: (id) => makeCExpr("openai/retrieve_chat_completion", [id]),
        ...
      }
    },
    embeddings: { create: (params) => makeCExpr("openai/create_embedding", [params]) },
    moderations: { create: (params) => makeCExpr("openai/create_moderation", [params]) },
    completions: { create: (params) => makeCExpr("openai/create_completion", [params]) },
  }
}
```

`defaultInterpreter` via lazy pattern (reads OPENAI_API_KEY).

---

## Task 9: Port plugin-anthropic

**Files:** Same pattern under `packages/plugin-anthropic/src/0.74.0/`

**Porting notes:**

9 node kinds, 3-level nesting: `$.anthropic.messages.batches.cancel(id)`.
Same pattern as openai — nested ctors, single params/id child per method.
`defaultInterpreter` via lazy pattern (reads ANTHROPIC_API_KEY).

---

## Task 10: Port plugin-fal

**Files:** Same pattern under `packages/plugin-fal/src/1.9.1/`

**Porting notes:**

6 node kinds. `$.fal.run(endpointId, opts?)`, `$.fal.queue.submit(endpointId, opts)`.
- children = [endpointId] or [endpointId, options]
- `Exprify<T>` helper type can be simplified since CExpr is already permissive.
`defaultInterpreter` via lazy pattern.

---

## Task 11: Port plugin-stripe

**Files:** Same pattern under `packages/plugin-stripe/src/2025-04-30.basil/`

**Porting notes:**

10 node kinds across 3 resources. `$.stripe.paymentIntents.create(params)`, `$.stripe.customers.update(id, params)`.
- Most: children = [params]
- Some (retrieve, update): children = [id] or [id, params]
`defaultInterpreter` via lazy pattern (reads STRIPE_SECRET_KEY).

---

## Task 12: Port plugin-twilio

**Files:** Same pattern under `packages/plugin-twilio/src/5.5.1/`

**Porting notes:**

6 node kinds. Has the callable + method pattern: `$.twilio.messages(sid).fetch()` AND `$.twilio.messages.create(params)`. This is the trickiest constructor pattern. The callable returns a builder with `.fetch()`, which creates the CExpr.

```ts
// Callable pattern:
messages: Object.assign(
  (sid) => ({ fetch: () => makeCExpr("twilio/fetch_message", [sid]) }),
  {
    create: (params) => makeCExpr("twilio/create_message", [params]),
    list: (params?) => params ? makeCExpr("twilio/list_messages", [params]) : makeCExpr("twilio/list_messages", []),
  }
)
```

`defaultInterpreter` via lazy pattern (reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).

---

## Task 13: Port plugin-redis

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/build-methods.ts`
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`
- Modify: `packages/plugin-redis/src/5.4.1/index.ts`
- Modify: `packages/plugin-redis/src/5.4.1/nodes.ts`
- Modify: `packages/plugin-redis/src/5.4.1/node-kinds.ts`
- Modify: `packages/plugin-redis/src/5.4.1/handler.client.ts`
- Modify: `packages/plugin-redis/src/5.4.1/handler.server.ts`
- Modify: `packages/plugin-redis/src/index.ts`
- Modify: All test files

**Porting notes:**

37 node kinds across string, key, hash, list operations. No `defaultInterpreter`.

Most operations follow simple patterns:
- `redis/get`: children = [key]
- `redis/set`: children = [key, value] or [key, value, options]
- `redis/hset`: children = [key, mapping]
- `redis/lrange`: children = [key, start, stop]

The interpreter uses `client.command(commandName, ...args)` — a single generic dispatch.
Port is mechanical but voluminous. The `build-methods.ts` file contains all constructor definitions.

---

## Task 14: Port plugin-postgres

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/index.ts`
- Modify: `packages/plugin-postgres/src/3.4.8/interpreter.ts`
- Modify: `packages/plugin-postgres/src/3.4.8/handler.server.ts`
- Modify: `packages/plugin-postgres/src/3.4.8/handler.client.ts`
- Modify: `packages/plugin-postgres/src/index.ts`
- Modify: All test files

**Porting notes:**

8 node kinds. Most complex interpreter due to nested evaluation for transactions:
- `postgres/query`: template tagged literal. Children = interleaved values. `entry.out` = string parts array.
- `postgres/begin`: children = [body]. Interpreter spawns a nested `fold()` call inside a transaction.
- `postgres/savepoint`: children = [body]. Nested `fold()` inside savepoint.
- `postgres/cursor`: children = [query, batchBody]. Nested iteration.

**Critical**: The `handler.server.ts` currently uses `foldAST()` for nested evaluation. Must be rewritten to use `fold(childId, adj, interpWithTxClient)` where `adj` is the shared adjacency map from the parent expression.

The tagged template `$.sql\`...\`` constructor is unique — it builds a CExpr where the string parts go into `out` (via a wrapper CExpr) and the interpolated values become children:
```ts
sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
  makeCExpr("postgres/query", values, /* out = */ [...strings])
```

Wait — `makeCExpr` only takes `(kind, args)`. The `out` field is set by `elaborate` only for literals. For storing the template string parts, we need a different approach. Options:
1. Store parts as a separate literal child (CExpr wrapping the string array)
2. Use a custom kind that elaborate recognizes

**Decision**: Store the string parts as a literal value child at index 0, with interpolated values at indices 1+. The interpreter reads `yield 0` to get the parts array, then `yield 1..N` for the values.

---

## Task 15: Port plugin-slack (codegen update)

**Files:**
- Modify: `packages/plugin-slack/scripts/codegen.ts` (or equivalent codegen script)
- Regenerate: All `packages/plugin-slack/src/7.14.0/generated/*.ts`
- Modify: `packages/plugin-slack/src/7.14.0/index.ts`
- Modify: `packages/plugin-slack/src/index.ts`
- Modify: Test files

**Porting notes:**

~160 generated files with ~200+ node kinds. **Do NOT hand-port.** Update the codegen script to emit new-API patterns:
1. Update generated `build-methods-*.ts` to emit `makeCExpr()` calls
2. Update generated `interpreter-*.ts` to emit `yield N` handlers
3. Update generated `types-*.ts` to remove TypedNode/NodeTypeMap
4. Regenerate all files
5. Update `index.ts` to compose into a Plugin object

The per-file template is mechanical — same positional pattern as other plugins.

---

## Task 16: Port plugin-zod

**Files:**
- Modify: All 34 files in `packages/plugin-zod/src/`
- Modify: All test files

**Porting notes:**

50+ node kinds. Unique architecture with class-based builders. The port requires:
1. Replace `ctx.expr()` calls throughout all builder classes with `makeCExpr()`
2. Replace `ctx.lift()` calls with raw values (CExpr accepts raw values)
3. Remove `ctx: PluginContext` from builder constructors
4. Rewrite interpreter handlers from `eval_(node.field)` to `yield N`
5. Remove all TypedNode interfaces and NodeTypeMap augmentations
6. Export a `Plugin`-shaped object (or factory)

The builder chain pattern (`.min().max().email().parse(value)`) maps to nested CExprs — each modifier wraps the previous schema CExpr as a child.

---

## Task 17: Full Validation

**Step 1: Build all packages**
```bash
npm run build
```

**Step 2: Type check**
```bash
npm run check
```

**Step 3: Run all tests**
```bash
npm test
```

**Step 4: Verify no old imports remain**
```bash
grep -r "definePlugin\|PluginContext\|TypedNode\|eval_\|defineInterpreter\|foldAST" packages/plugin-*/src/ --include="*.ts"
```

Expected: No matches.

**Step 5: Verify no `any` in production code**
```bash
grep -r ": any\|as any" packages/plugin-*/src/ --include="*.ts" | grep -v "test"
```

Expected: No matches (or only in type assertions that are genuinely needed).

**Step 6: Commit final validation**
```bash
git add -A
git commit -m "chore: verify clean build after full external plugin port"
```
