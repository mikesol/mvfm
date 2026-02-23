# Liftable<T> + shapes + resolveStructured() Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~55 copies of `liftArg` boilerplate across 14 plugins by adopting the core `Liftable<T>`, `shapes`, and `resolveStructured()` APIs.

**Architecture:** Each plugin independently migrates from per-plugin `liftArg()` + `plugin/record` + `plugin/array` kinds to the core's declarative `shapes` field and `resolveStructured()` helper. The openai plugin (already migrated) is the reference.

**Tech Stack:** TypeScript, @mvfm/core (Liftable, resolveStructured, makeCExpr, shapes)

---

## Reference files

Read these before starting any task:
- `packages/plugin-openai/src/6.21.0/index.ts` — shapes, Liftable<T>, makeCExpr pattern
- `packages/plugin-openai/src/6.21.0/interpreter.ts` — resolveStructured() pattern

## Common migration pattern

Every standard plugin follows these steps:
1. Delete `liftArg()` function and `mk` helper
2. Delete `plugin/record` + `plugin/array` from `kinds`
3. Delete `plugin/record` + `plugin/array` handlers from interpreter
4. Add `import { Liftable, resolveStructured } from "@mvfm/core"` (Liftable is a type import)
5. Add `shapes: { ... }` to plugin object
6. Update constructor params: remove `liftArg()` calls, pass params directly to `makeCExpr`
7. Update constructor type signatures: `<A>(params: A)` → `(params: Liftable<SdkType>)`
8. Update interpreter handlers: `yield 0` → `yield* resolveStructured(entry.children[0])` for structural args
9. Run `npm run build && npm run check && npm test`

---

### Task 1: Migrate plugin-anthropic

**Files:**
- Modify: `packages/plugin-anthropic/src/0.74.0/index.ts`
- Modify: `packages/plugin-anthropic/src/0.74.0/interpreter.ts`
- Test: `packages/plugin-anthropic/tests/0.74.0/`

**Step 1: Read the current files**

Read `packages/plugin-anthropic/src/0.74.0/index.ts` and `interpreter.ts` fully.

**Step 2: Modify index.ts**

1. Add to imports: `import type { Liftable } from "@mvfm/core";` (add to existing core import line)
2. Delete `liftArg` function (lines 36-53)
3. Delete the `mk` cast helper if present
4. In constructors:
   - `messages.create(params)`: change `<A>(params: A)` → `(params: Liftable<MessageCreateParams>)`, remove `liftArg(params)`, pass `params` directly to `makeCExpr`
   - `messages.countTokens(params)`: same pattern with `Liftable<MessageTokensCount>` (or the correct SDK params type)
   - `messages.batches.create(params)`: same with batch params type
   - `messages.batches.list(...params)`: remove `params.map(liftArg)`, pass `params` directly
   - `models.list(...params)`: same
   - `retrieve`/`cancel`/`delete` methods: leave unchanged (they don't use liftArg)
5. Delete `anthropic/record` and `anthropic/array` from `kinds` (lines 225-233)
6. Add `shapes` field to plugin object:
   ```typescript
   shapes: {
     "anthropic/create_message": "*",
     "anthropic/count_tokens": "*",
     "anthropic/create_message_batch": "*",
     "anthropic/list_message_batches": "*",
     "anthropic/list_models": "*",
   },
   ```
7. Type KindSpecs with SDK types where available

**Step 3: Modify interpreter.ts**

1. Add `import { resolveStructured } from "@mvfm/core";`
2. Delete `anthropic/record` handler (lines 77-85)
3. Delete `anthropic/array` handler (lines 87-93)
4. Update structural handlers:
   - `create_message`: `const body = yield 0;` → `const body = yield* resolveStructured(entry.children[0]);`
   - `count_tokens`: same pattern
   - `create_message_batch`: same
   - `list_message_batches`/`list_models`: for variadic args, resolve each child
5. Non-structural handlers (retrieve, cancel, delete): leave unchanged (`yield 0` for id is correct)

**Step 4: Validate**

Run: `cd packages/plugin-anthropic && npm run build && npm run check && npm test`

**Step 5: Commit**

```bash
git add packages/plugin-anthropic/
git commit -m "refactor(anthropic): adopt Liftable<T> + shapes + resolveStructured()"
```

---

### Task 2: Migrate plugin-s3

**Files:**
- Modify: `packages/plugin-s3/src/3.989.0/index.ts`
- Modify: `packages/plugin-s3/src/3.989.0/interpreter.ts`
- Test: `packages/plugin-s3/tests/3.989.0/`

**Step 1: Read the current files**

Read `packages/plugin-s3/src/3.989.0/index.ts` and `interpreter.ts`.

**Step 2: Modify index.ts**

1. Add `Liftable` to core type imports
2. Delete `liftArg` (lines 40-57) and `mk` helper
3. Delete `s3/record` + `s3/array` from `kinds` (lines 162-169)
4. Update 5 constructors (putObject, getObject, deleteObject, headObject, listObjectsV2):
   - Remove `liftArg(input)`, pass `input` directly
   - Type params with `Liftable<PutObjectCommandInput>` etc.
5. Add `shapes`:
   ```typescript
   shapes: {
     "s3/put_object": "*",
     "s3/get_object": "*",
     "s3/delete_object": "*",
     "s3/head_object": "*",
     "s3/list_objects_v2": "*",
   },
   ```
6. Type KindSpecs: `KindSpec<[PutObjectCommandInput], PutObjectCommandOutput>` etc.

**Step 3: Modify interpreter.ts**

1. Add `import { resolveStructured } from "@mvfm/core";`
2. Delete `s3/record` + `s3/array` handlers (lines 48-64)
3. Update all 5 handlers: `yield 0` → `yield* resolveStructured(entry.children[0])`

**Step 4: Validate**

Run: `cd packages/plugin-s3 && npm run build && npm run check && npm test`

**Step 5: Commit**

```bash
git add packages/plugin-s3/
git commit -m "refactor(s3): adopt Liftable<T> + shapes + resolveStructured()"
```

---

### Task 3: Migrate plugin-resend

**Files:**
- Modify: `packages/plugin-resend/src/6.9.2/index.ts`
- Modify: `packages/plugin-resend/src/6.9.2/interpreter.ts`
- Test: `packages/plugin-resend/tests/6.9.2/`

Follow standard pattern. Key details:
- `send_email` and `batch.send` take structural params → `"*"`
- `get`/`update`/`delete` by ID: no shape (plain id)
- `contacts.create`: structural → `"*"`
- `batch.send`: the array arg wrapping needs attention — check if `resend/array` is used explicitly for the batch
- SDK types: `CreateEmailOptions`, `CreateEmailResponse`, etc.

**Step 1-5:** Same flow as Tasks 1-2. Read, modify index.ts (delete liftArg, add shapes/Liftable), modify interpreter.ts (delete record/array, add resolveStructured), validate, commit.

---

### Task 4: Migrate plugin-stripe

**Files:**
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/index.ts`
- Modify: `packages/plugin-stripe/src/2025-04-30.basil/interpreter.ts`
- Test: `packages/plugin-stripe/tests/2025-04-30.basil/`

Key details:
- Mixed args: `create(params)` → `"*"`, `update(id, params)` → `[null, "*"]`, `confirm(id, ...params)` → `[null, "*"]`
- `retrieve(id)`: no shape
- `list(...params)`: `"*"`
- SDK types: `Stripe.PaymentIntentCreateParams`, `Stripe.PaymentIntent`, etc.

**Step 1-5:** Standard flow.

---

### Task 5: Migrate plugin-fetch

**Files:**
- Modify: `packages/plugin-fetch/src/whatwg/index.ts`
- Modify: `packages/plugin-fetch/src/whatwg/interpreter.ts`
- Test: `packages/plugin-fetch/tests/whatwg/`

Key details:
- `fetch/request`: `[null, "*"]` (url is plain string, init is structural)
- `fetch/json`, `fetch/text`, `fetch/status`, `fetch/headers`: no shapes (response is opaque)
- SDK type: `Liftable<RequestInit>` for the init param

**Step 1-5:** Standard flow.

---

### Task 6: Migrate plugin-fal

**Files:**
- Modify: `packages/plugin-fal/src/1.9.1/index.ts`
- Modify: `packages/plugin-fal/src/1.9.1/interpreter.ts`
- Test: `packages/plugin-fal/tests/1.9.1/`

Key details:
- All methods: `[null, "*"]` (endpointId is plain, options is structural)
- Limited SDK types — use `Liftable<Record<string, unknown>>` or check fal SDK for types

**Step 1-5:** Standard flow.

---

### Task 7: Migrate plugin-twilio

**Files:**
- Modify: `packages/plugin-twilio/src/5.5.1/index.ts`
- Modify: `packages/plugin-twilio/src/5.5.1/interpreter.ts`
- Test: `packages/plugin-twilio/tests/5.5.1/`

Key details:
- `create_message`, `create_call`: `"*"` (single params object)
- `list_messages`, `list_calls`: `"*"` (optional params)
- `fetch_message`, `fetch_call`: no shape (sid is plain)
- Limited SDK types — use `Record<string, unknown>` fallback

**Step 1-5:** Standard flow.

---

### Task 8: Migrate plugin-cloudflare-kv

**Files:**
- Modify: `packages/plugin-cloudflare-kv/src/4.20260213.0/index.ts`
- Modify: `packages/plugin-cloudflare-kv/src/4.20260213.0/interpreter.ts`
- Test: `packages/plugin-cloudflare-kv/tests/4.20260213.0/`

Key details:
- All args are liftArg'd (keys pass through as primitives, only options objects become records)
- `put`: `"*"` (all args — key/value/options)
- `list`: `"*"` (optional options)
- `get_text`/`get_json`: `"*"` (key only, but was liftArg'd for uniformity)
- `delete`: `"*"` (key only)

**Step 1-5:** Standard flow.

---

### Task 9: Migrate plugin-pino

**Files:**
- Modify: `packages/plugin-pino/src/10.3.1/index.ts`
- Modify: `packages/plugin-pino/src/10.3.1/interpreter.ts`
- Test: `packages/plugin-pino/tests/10.3.1/`

Key details — **pino has unique children layout**: `[hasMsg(0|1), hasMergeObj(0|1), msg?, mergeObj?, ...bindings]`
- The flags (hasMsg, hasMergeObj) and msg are NOT structural
- The mergeObject and bindings ARE structural
- Shapes need to be carefully declared. Check the exact children indices for each kind.
- `pino/child`: `"*"` (bindings arg)
- Log-level kinds: need per-arg shapes matching the children layout — read the code carefully and declare shapes for only the structural positions
- If per-arg shapes can't express the variadic layout, may need to keep `resolveStructured` only in the interpreter without shapes, or use `"*"` conservatively

**Step 1-5:** Standard flow but read extra carefully.

---

### Task 10: Migrate plugin-postgres

**Files:**
- Modify: `packages/plugin-postgres/src/3.4.8/build-methods.ts`
- Modify: `packages/plugin-postgres/src/3.4.8/index.ts`
- Modify: `packages/plugin-postgres/src/3.4.8/interpreter.ts`
- Test: `packages/plugin-postgres/tests/3.4.8/`

Key details:
- `liftArg` is in `build-methods.ts` (not index.ts)
- Only `insert()` and `set()` use liftArg — on the data arg
- `postgres/insert_helper`: `["*", null]` (data is structural, columnsJson is plain)
- `postgres/set_helper`: same
- **DO NOT** add shapes to `postgres/query` or other SQL template kinds
- SQL template literals use a completely different mechanism

**Step 1-5:** Standard flow.

---

### Task 11: Migrate plugin-redis

**Files:**
- Modify: `packages/plugin-redis/src/5.4.1/build-methods.ts`
- Modify: `packages/plugin-redis/src/5.4.1/index.ts`
- Modify: `packages/plugin-redis/src/5.4.1/interpreter.ts`
- Modify: `packages/plugin-redis/src/5.4.1/interpreter-list.ts`
- Test: `packages/plugin-redis/tests/5.4.1/`

Key details:
- `liftArg` in `build-methods.ts`, used in ALL 35+ methods on every arg
- ALL args are liftArg'd (primitives pass through unchanged)
- Shapes: `"*"` for every kind (since all args are uniformly liftArg'd)
- Delete `redis/record` + `redis/array` from `index.ts` (lines 179-188)
- Delete `redis/record` + `redis/array` handlers from `interpreter.ts` (lines 204-221)
- In interpreter, update handlers that receive objects (hset, mset, etc.) to use `resolveStructured`
- For simple string/number commands (get, set, del), `resolveStructured` still works since it passes through primitives

**Step 1-5:** Standard flow.

---

### Task 12: Migrate plugin-console

**Files:**
- Modify: `packages/plugin-console/src/22.0.0/index.ts`
- Modify: `packages/plugin-console/src/22.0.0/interpreter.ts`
- Test: `packages/plugin-console/tests/22.0.0/`

**Special case:** Console uses `liftConsoleArg` which wraps objects in `core/record` and arrays in `core/tuple` (not namespaced `console/record`/`console/array`). No kinds to delete.

Key details:
- Delete `liftConsoleArg` (lines 14-20)
- Only 3 methods use it: `dir`, `dirxml`, `table` — remove calls, pass args directly
- Add shapes for kinds where structural args are passed (dir, dirxml, table)
- The interpreter uses dynamic handler generation — update to use `resolveStructured` where args were previously lifted
- No `console/record`/`console/array` kinds exist, so nothing to delete from kinds

**Step 1-5:** Standard flow but simpler — no kinds to delete.

---

### Task 13: Migrate plugin-slack (codegen)

**Files:**
- Modify: `packages/plugin-slack/scripts/codegen.ts`
- Modify: `packages/plugin-slack/src/7.14.0/index.ts` (remove record/array kinds)
- Regenerate: all `src/7.14.0/generated/` files
- Test: `packages/plugin-slack/tests/7.14.0/`

**This is the largest task — update the codegen, then regenerate.**

**Step 1: Read codegen.ts fully**

Read `packages/plugin-slack/scripts/codegen.ts`.

**Step 2: Modify codegen template — build-methods**

In the `generateBuildMethods()` function:
1. Remove the `liftArg` function template (lines 375-392)
2. Remove `liftArg(params)` from method bodies — pass `params` directly to `makeCExpr`
3. Add `Liftable` to the core import template
4. Update constructor type signatures to use `Liftable<T>` where Slack types are available

**Step 3: Modify codegen template — interpreter**

In the `generateInterpreter()` function:
1. Add `resolveStructured` to core import
2. Update handler template: `yield 0` → `yield* resolveStructured(entry.children[0])` for params
3. In `generateInterpreterIndex()`: remove the `slack/record` and `slack/array` handler templates (lines 576-591)

**Step 4: Modify index.ts**

1. Remove `slack/record` + `slack/array` from the kinds registration (lines 88-101)
2. Add `shapes` field to plugin object — all Slack API methods take optional params → `"*"` for all kinds

**Step 5: Regenerate**

Run: `cd packages/plugin-slack && npx tsx scripts/codegen.ts`

**Step 6: Validate**

Run: `cd packages/plugin-slack && npm run build && npm run check && npm test`

**Step 7: Commit**

```bash
git add packages/plugin-slack/
git commit -m "refactor(slack): adopt Liftable<T> + shapes + resolveStructured() via codegen"
```

---

### Task 14: Evaluate plugin-zod

**Files:**
- Read: `packages/plugin-zod/src/extract-cexprs.ts`
- Read: `packages/plugin-zod/src/index.ts`
- Read: `packages/plugin-zod/src/interpreter.ts`

**This is evaluation only — zod has no liftArg.**

**Step 1: Read and understand**

Read `extract-cexprs.ts` and understand the manual `isCExpr()` walk. Compare to what `shapes` + `resolveStructured()` would provide.

**Step 2: Evaluate**

Determine:
- Does zod's CExpr extraction pattern match what `shapes` handles? (i.e., are CExprs embedded in object/array structures that shapes can walk?)
- Or is the pattern fundamentally different? (e.g., CExprs embedded in Zod schema descriptors, not in runtime values)

**Step 3: Decision**

- If shapes can replace extract-cexprs.ts: migrate (add shapes, use resolveStructured in interpreter, delete extract-cexprs.ts)
- If not: document why in a comment and skip migration
- **DO NOT delete `zod/record` or `zod/array`** — these are schema types, not structural helpers

**Step 4: Validate if changes were made**

Run: `cd packages/plugin-zod && npm run build && npm run check && npm test`

**Step 5: Commit if changes were made**

```bash
git add packages/plugin-zod/
git commit -m "refactor(zod): evaluate shapes adoption (or: adopt shapes for parse kinds)"
```

---

### Task 15: Final validation

**Step 1: Full monorepo build**

Run from repo root:
```bash
npm run build && npm run check && npm test
```

**Step 2: Verify no remaining liftArg**

Search the codebase for any remaining `liftArg` references (excluding openai reference, docs, and git history):
```bash
grep -r "liftArg" packages/ --include="*.ts" -l
```

Expected: no results (or only docs/comments).

**Step 3: Commit any fixups**

If there are cross-plugin issues discovered during the full build, fix and commit.
