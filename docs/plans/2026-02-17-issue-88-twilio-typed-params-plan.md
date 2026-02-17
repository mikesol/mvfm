# Issue #88: Twilio Typed Params Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `Record<string, unknown>` in the twilio plugin with twilio-node SDK types for full request/response type parity.

**Architecture:** Import types directly from `twilio` (already added as devDependency at 5.5.1). Use deep import paths via a local `types.ts` re-export file. Thread imported types through `index.ts` interfaces and `interpreter.ts` node interfaces.

**Tech Stack:** TypeScript, twilio-node 5.5.1 types, pnpm workspaces, Vitest, Biome, API Extractor.

---

### Task 1: Create types.ts re-export file

**Files:**
- Create: `packages/plugin-twilio/src/5.5.1/types.ts`

**Step 1: Create the re-export file**

```typescript
/**
 * Re-exports of twilio-node SDK types used by the twilio plugin.
 *
 * Centralizes deep import paths so the rest of the plugin imports from `./types`.
 * All imports are type-only — zero runtime cost.
 */
export type {
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
  MessageInstance,
} from "twilio/lib/rest/api/v2010/account/message";

export type {
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
  CallInstance,
} from "twilio/lib/rest/api/v2010/account/call";
```

**Step 2: Verify it compiles**

Run: `pnpm --filter @mvfm/plugin-twilio run build`
Expected: PASS (type-only re-exports, no runtime)

**Step 3: Commit**

```bash
git add packages/plugin-twilio/src/5.5.1/types.ts
git commit -m "feat(plugin-twilio): add types.ts re-exporting twilio-node SDK types"
```

---

### Task 2: Update index.ts interfaces with SDK types

**Files:**
- Modify: `packages/plugin-twilio/src/5.5.1/index.ts`

**Step 1: Write failing type test**

Add a new test file `packages/plugin-twilio/tests/5.5.1/types.test.ts`:

```typescript
import { mvfm, num, str } from "@mvfm/core";
import type { Expr } from "@mvfm/core";
import { describe, expectTypeOf, it } from "vitest";
import { twilio } from "../../src/5.5.1";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import type { CallInstance } from "twilio/lib/rest/api/v2010/account/call";

const app = mvfm(num, str, twilio({ accountSid: "AC_test", authToken: "tok" }));

describe("twilio type parity", () => {
  it("messages.create returns Expr<MessageInstance>", () => {
    app(($) => {
      const msg = $.twilio.messages.create({ to: "+1", from: "+1", body: "hi" });
      expectTypeOf(msg).toEqualTypeOf<Expr<MessageInstance>>();
      return msg;
    });
  });

  it("messages(sid).fetch returns Expr<MessageInstance>", () => {
    app(($) => {
      const msg = $.twilio.messages("SM123").fetch();
      expectTypeOf(msg).toEqualTypeOf<Expr<MessageInstance>>();
      return msg;
    });
  });

  it("messages.list returns Expr<MessageInstance[]>", () => {
    app(($) => {
      const msgs = $.twilio.messages.list({ pageSize: 10 });
      expectTypeOf(msgs).toEqualTypeOf<Expr<MessageInstance[]>>();
      return msgs;
    });
  });

  it("calls.create returns Expr<CallInstance>", () => {
    app(($) => {
      const call = $.twilio.calls.create({ to: "+1", from: "+1", url: "https://x.com/twiml" });
      expectTypeOf(call).toEqualTypeOf<Expr<CallInstance>>();
      return call;
    });
  });

  it("calls(sid).fetch returns Expr<CallInstance>", () => {
    app(($) => {
      const call = $.twilio.calls("CA123").fetch();
      expectTypeOf(call).toEqualTypeOf<Expr<CallInstance>>();
      return call;
    });
  });

  it("calls.list returns Expr<CallInstance[]>", () => {
    app(($) => {
      const calls = $.twilio.calls.list({ pageSize: 20 });
      expectTypeOf(calls).toEqualTypeOf<Expr<CallInstance[]>>();
      return calls;
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @mvfm/plugin-twilio run test`
Expected: FAIL — types currently are `Expr<Record<string, unknown>>`, not `Expr<MessageInstance>` etc.

**Step 3: Update index.ts imports**

Add at the top of `packages/plugin-twilio/src/5.5.1/index.ts` (after existing imports):

```typescript
import type {
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
  MessageInstance,
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
  CallInstance,
} from "./types";
```

**Step 4: Update TwilioMessageContext**

Replace lines 62-65:

```typescript
/** Context returned by `$.twilio.messages(sid)` — mirrors twilio-node's MessageContext. */
export interface TwilioMessageContext {
  /** Fetch this message by its SID. */
  fetch(): Expr<MessageInstance>;
}
```

**Step 5: Update TwilioCallContext**

Replace lines 68-71:

```typescript
/** Context returned by `$.twilio.calls(sid)` — mirrors twilio-node's CallContext. */
export interface TwilioCallContext {
  /** Fetch this call by its SID. */
  fetch(): Expr<CallInstance>;
}
```

**Step 6: Update TwilioMessagesResource**

Replace lines 77-88:

```typescript
/**
 * The messages resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.messages.create(...)` and `client.messages(sid).fetch()`.
 */
export interface TwilioMessagesResource {
  /** Get a message context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioMessageContext;
  /** Send an SMS/MMS message. */
  create(
    params: Expr<MessageListInstanceCreateOptions> | MessageListInstanceCreateOptions,
  ): Expr<MessageInstance>;
  /** List messages with optional filter params. */
  list(
    params?: Expr<MessageListInstanceOptions> | MessageListInstanceOptions,
  ): Expr<MessageInstance[]>;
}
```

**Step 7: Update TwilioCallsResource**

Replace lines 94-105:

```typescript
/**
 * The calls resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.calls.create(...)` and `client.calls(sid).fetch()`.
 */
export interface TwilioCallsResource {
  /** Get a call context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioCallContext;
  /** Initiate an outbound call. */
  create(
    params: Expr<CallListInstanceCreateOptions> | CallListInstanceCreateOptions,
  ): Expr<CallInstance>;
  /** List calls with optional filter params. */
  list(
    params?: Expr<CallListInstanceOptions> | CallListInstanceOptions,
  ): Expr<CallInstance[]>;
}
```

**Step 8: Update resolveParams and build method signatures**

In the `build()` function body (lines 168-169), update `resolveParams` to accept the union:

```typescript
function resolveParams(
  params:
    | Expr<MessageListInstanceCreateOptions>
    | MessageListInstanceCreateOptions
    | Expr<MessageListInstanceOptions>
    | MessageListInstanceOptions
    | Expr<CallListInstanceCreateOptions>
    | CallListInstanceCreateOptions
    | Expr<CallListInstanceOptions>
    | CallListInstanceOptions,
) {
  return ctx.lift(params).__node;
}
```

Then update each inline method's params type to match the interface — the `create` and `list` method bodies inside `Object.assign` must use the specific types instead of `Record<string, unknown>`.

For messages `create` (line 185): `params: Expr<MessageListInstanceCreateOptions> | MessageListInstanceCreateOptions`
For messages `list` (line 192): `params?: Expr<MessageListInstanceOptions> | MessageListInstanceOptions`
For calls `create` (line 214): `params: Expr<CallListInstanceCreateOptions> | CallListInstanceCreateOptions`
For calls `list` (line 221): `params?: Expr<CallListInstanceOptions> | CallListInstanceOptions`

And update `ctx.expr` calls with proper phantom types:
- `ctx.expr<MessageInstance>(...)` for message create/fetch
- `ctx.expr<MessageInstance[]>(...)` for message list
- `ctx.expr<CallInstance>(...)` for call create/fetch
- `ctx.expr<CallInstance[]>(...)` for call list

**Step 9: Update honest assessment comment**

Update the comment at line 268-271 about return types to note they now use SDK types.

**Step 10: Run tests to verify type test passes**

Run: `pnpm --filter @mvfm/plugin-twilio run test`
Expected: ALL PASS (type tests and existing behavior tests)

**Step 11: Commit**

```bash
git add packages/plugin-twilio/src/5.5.1/index.ts packages/plugin-twilio/tests/5.5.1/types.test.ts
git commit -m "feat(plugin-twilio): replace Record<string, unknown> with twilio-node SDK types in index.ts"
```

---

### Task 3: Update interpreter.ts node interfaces

**Files:**
- Modify: `packages/plugin-twilio/src/5.5.1/interpreter.ts`

**Step 1: Add type imports**

Add after line 3:

```typescript
import type {
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
  MessageInstance,
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
  CallInstance,
} from "./types";
```

**Step 2: Update TwilioNode base phantom type**

Line 24 — the base `TwilioNode` uses `TypedNode<unknown>`. This stays as-is since each concrete node overrides the phantom type.

**Step 3: Update node interfaces**

Replace lines 29-51 with specific phantom types:

```typescript
export interface TwilioCreateMessageNode extends TwilioNode<"twilio/create_message"> {
  params: TypedNode<MessageListInstanceCreateOptions>;
}

export interface TwilioFetchMessageNode extends TwilioNode<"twilio/fetch_message"> {
  sid: TypedNode<string>;
}

export interface TwilioListMessagesNode extends TwilioNode<"twilio/list_messages"> {
  params?: TypedNode<MessageListInstanceOptions> | null;
}

export interface TwilioCreateCallNode extends TwilioNode<"twilio/create_call"> {
  params: TypedNode<CallListInstanceCreateOptions>;
}

export interface TwilioFetchCallNode extends TwilioNode<"twilio/fetch_call"> {
  sid: TypedNode<string>;
}

export interface TwilioListCallsNode extends TwilioNode<"twilio/list_calls"> {
  params?: TypedNode<CallListInstanceOptions> | null;
}
```

**Step 4: Run build and tests**

Run: `pnpm --filter @mvfm/plugin-twilio run build && pnpm --filter @mvfm/plugin-twilio run test`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/plugin-twilio/src/5.5.1/interpreter.ts
git commit -m "feat(plugin-twilio): thread SDK types through interpreter node interfaces"
```

---

### Task 4: Regenerate API report and run full checks

**Files:**
- Modified (auto-generated): `packages/plugin-twilio/etc/plugin-twilio.api.md`
- Modified (auto-generated): `packages/plugin-twilio/etc/plugin-twilio.api.json`

**Step 1: Run full check (includes API extractor)**

Run: `pnpm --filter @mvfm/core run build && pnpm --filter @mvfm/plugin-twilio run check`

If API extractor reports drift, update the report:

Run: `pnpm --filter @mvfm/plugin-twilio exec api-extractor run --local`

**Step 2: Run full test suite**

Run: `pnpm --filter @mvfm/plugin-twilio run test`
Expected: ALL PASS

**Step 3: Commit updated API report**

```bash
git add packages/plugin-twilio/etc/
git commit -m "chore(plugin-twilio): regenerate API report after typing update"
```

---

### Task 5: Run top-level validation

**Step 1: Full monorepo build + check + test**

Run: `npm run build && npm run check && npm test`
Expected: ALL PASS

No commit needed — this is validation only.
