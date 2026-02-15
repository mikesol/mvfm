# Twilio Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `twilio` plugin (issue #55) modeling twilio-node v5.5.1 with Messages and Calls resources.

**Architecture:** External-service plugin at `src/plugins/twilio/5.5.1/` following the Stripe plugin pattern. Configured factory function, uniform `twilio/api_call` effect, 6 node kinds (create/fetch/list for Messages and Calls). All REST request-response, no scoping. **Key ergonomic difference from Stripe:** Twilio SDK uses `client.messages(sid).fetch()` callable pattern, not flat `messages.fetch(sid)`. We match this exactly using `Object.assign` to make `$.twilio.messages` both callable and have `.create()`/`.list()` properties.

**Tech Stack:** TypeScript, vitest, mvfm core (`Expr`, `PluginContext`, `PluginDefinition`, `InterpreterFragment`, `StepHandler`, `foldAST`, `runAST`)

**Design doc:** `docs/plans/2026-02-13-twilio-plugin-design.md`

**Reference files:** The Stripe plugin is the 1:1 template:
- `src/plugins/stripe/2025-04-30.basil/index.ts` — plugin definition
- `src/plugins/stripe/2025-04-30.basil/interpreter.ts` — interpreter fragment
- `src/plugins/stripe/2025-04-30.basil/handler.server.ts` — server handler
- `src/plugins/stripe/2025-04-30.basil/handler.client.ts` — client handler
- `src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts` — SDK adapter
- `tests/plugins/stripe/2025-04-30.basil/index.test.ts` — AST tests
- `tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts` — interpreter tests
- `tests/plugins/stripe/2025-04-30.basil/integration.test.ts` — integration tests

**Working directory:** `.worktrees/issue-55/`

---

### Task 1: Create directory structure and plugin definition with tests

**Files:**
- Create: `src/plugins/twilio/5.5.1/index.ts`
- Create: `tests/plugins/twilio/5.5.1/index.test.ts`

**Step 1: Create the directory structure**

```bash
mkdir -p src/plugins/twilio/5.5.1
mkdir -p tests/plugins/twilio/5.5.1
```

**Step 2: Write the failing AST tests**

Create `tests/plugins/twilio/5.5.1/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { twilio } from "../../../../src/plugins/twilio/5.5.1";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, twilio({ accountSid: "AC_test_123", authToken: "auth_test_456" }));

// ============================================================
// Messages
// ============================================================

describe("twilio: messages.create", () => {
  it("produces twilio/create_message node", () => {
    const prog = app(($) => {
      return $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_message");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.to.kind).toBe("core/literal");
    expect(ast.result.params.fields.to.value).toBe("+15551234567");
    expect(ast.result.params.fields.body.value).toBe("Hello");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.twilio.messages.create({
        to: $.input.to,
        from: $.input.from,
        body: $.input.body,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_message");
    expect(ast.result.params.fields.to.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.body.kind).toBe("core/prop_access");
  });
});

describe("twilio: messages(sid).fetch", () => {
  it("produces twilio/fetch_message node with literal sid", () => {
    const prog = app(($) => {
      return $.twilio.messages("SM800f449d0399ed014aae2bcc0cc2f2ec").fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_message");
    expect(ast.result.sid.kind).toBe("core/literal");
    expect(ast.result.sid.value).toBe("SM800f449d0399ed014aae2bcc0cc2f2ec");
  });

  it("accepts Expr<string> sid", () => {
    const prog = app(($) => {
      return $.twilio.messages($.input.messageSid).fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_message");
    expect(ast.result.sid.kind).toBe("core/prop_access");
  });
});

describe("twilio: messages.list", () => {
  it("produces twilio/list_messages node with params", () => {
    const prog = app(($) => {
      return $.twilio.messages.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_messages");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(10);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.twilio.messages.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_messages");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio: calls.create", () => {
  it("produces twilio/create_call node", () => {
    const prog = app(($) => {
      return $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/create_call");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.to.value).toBe("+15551234567");
    expect(ast.result.params.fields.url.value).toBe("https://example.com/twiml");
  });
});

describe("twilio: calls(sid).fetch", () => {
  it("produces twilio/fetch_call node with literal sid", () => {
    const prog = app(($) => {
      return $.twilio.calls("CA42ed11f93dc08b952027ffbc406d0868").fetch();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/fetch_call");
    expect(ast.result.sid.kind).toBe("core/literal");
    expect(ast.result.sid.value).toBe("CA42ed11f93dc08b952027ffbc406d0868");
  });
});

describe("twilio: calls.list", () => {
  it("produces twilio/list_calls node with params", () => {
    const prog = app(($) => {
      return $.twilio.calls.list({ limit: 20 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_calls");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(20);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.twilio.calls.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("twilio/list_calls");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Integration: $.do() and cross-operation dependencies
// ============================================================

describe("twilio: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.twilio.messages.create({
          to: "+15551234567",
          from: "+15559876543",
          body: "Hello",
        });
        const call = $.twilio.calls.create({
          to: "+15551234567",
          from: "+15559876543",
          url: "https://example.com/twiml",
        });
        return $.do(msg, call);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const msg = $.twilio.messages("SM_123").fetch();
        $.twilio.messages.create({ to: "+1", from: "+2", body: "orphan" }); // orphan!
        return msg;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("twilio: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const msg = $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Hello",
      });
      const fetched = $.twilio.messages((msg as any).sid).fetch();
      return $.do(msg, fetched);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
```

**Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/plugins/twilio/5.5.1/index.test.ts`
Expected: FAIL (module not found — `src/plugins/twilio/5.5.1` doesn't exist yet)

**Step 4: Write the plugin definition**

Create `src/plugins/twilio/5.5.1/index.ts`:

```ts
// ============================================================
// MVFM PLUGIN: twilio (twilio-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (2 of 30+ service domains)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (2 of 30+ domains)
//
// Implemented:
//   - Messages: create, fetch, list
//   - Calls: create, fetch, list
//
// Not doable (fundamental mismatch with AST model):
//   - Auto-pagination (each() with async iterator — push-based)
//   - Webhooks / status callbacks (server-initiated push)
//   - TwiML generation (XML construction, not REST API)
//   - Real-time call control (stateful, TwiML-driven)
//
// Remaining (same REST pattern, add as needed):
//   Messages: update (cancel), remove
//   Calls: update (modify in-progress)
//   Verify: services, verifications, verification checks
//   Lookups: phone number lookup
//   Conversations, Sync, Studio, and 20+ other service domains
//
//   Each resource follows the same CRUD pattern: add node kinds,
//   add methods to TwilioMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — twilio/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows twilio-node should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real twilio-node SDK as closely as possible.
//
// Real twilio-node API (v5.5.1):
//   const client = require('twilio')(accountSid, authToken)
//   const msg = await client.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//   const msg = await client.messages('SM123').fetch()
//   const msgs = await client.messages.list({ limit: 10 })
//   const call = await client.calls.create({ to: '+1...', from: '+1...', url: 'https://...' })
//   const call = await client.calls('CA123').fetch()
//   const calls = await client.calls.list({ limit: 20 })
//
// Based on source-level analysis of twilio-node
// (github.com/twilio/twilio-node, tag 5.5.1). The SDK is
// auto-generated from OpenAPI specs. Each resource lives under
// src/rest/api/v2010/account/ with ListInstance (create, list)
// and Context (fetch, update, remove) patterns. All operations
// are REST request-response over https://api.twilio.com with
// Basic auth (accountSid:authToken).
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Twilio operations added to the DSL context by the twilio plugin.
 *
 * Mirrors the twilio-node SDK resource API: messages and calls.
 * Each resource exposes create/fetch/list methods that produce
 * namespaced AST nodes.
 */
/** Context returned by `$.twilio.messages(sid)` — mirrors twilio-node's MessageContext. */
export interface TwilioMessageContext {
  /** Fetch this message by its SID. */
  fetch(): Expr<Record<string, unknown>>;
}

/** Context returned by `$.twilio.calls(sid)` — mirrors twilio-node's CallContext. */
export interface TwilioCallContext {
  /** Fetch this call by its SID. */
  fetch(): Expr<Record<string, unknown>>;
}

/**
 * The messages resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.messages.create(...)` and `client.messages(sid).fetch()`.
 */
export interface TwilioMessagesResource {
  /** Get a message context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioMessageContext;
  /** Send an SMS/MMS message. */
  create(
    params: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
  /** List messages with optional filter params. */
  list(
    params?: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
}

/**
 * The calls resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.calls.create(...)` and `client.calls(sid).fetch()`.
 */
export interface TwilioCallsResource {
  /** Get a call context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioCallContext;
  /** Initiate an outbound call. */
  create(
    params: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
  /** List calls with optional filter params. */
  list(
    params?: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
}

export interface TwilioMethods {
  /** Twilio API operations, namespaced under `$.twilio`. */
  twilio: {
    /** Messages resource. Callable: `messages(sid).fetch()`, or `messages.create(...)`. */
    messages: TwilioMessagesResource;
    /** Calls resource. Callable: `calls(sid).fetch()`, or `calls.create(...)`. */
    calls: TwilioCallsResource;
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the twilio plugin.
 *
 * Requires accountSid and authToken for Basic auth against
 * the Twilio REST API.
 */
export interface TwilioConfig {
  /** Twilio Account SID (e.g. `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`). */
  accountSid: string;
  /** Twilio Auth Token. */
  authToken: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Twilio plugin factory. Namespace: `twilio/`.
 *
 * Creates a plugin that exposes messages and calls resource methods
 * for building parameterized Twilio API call AST nodes.
 *
 * @param config - A {@link TwilioConfig} with accountSid and authToken.
 * @returns A {@link PluginDefinition} for the twilio plugin.
 */
export function twilio(config: TwilioConfig): PluginDefinition<TwilioMethods> {
  return {
    name: "twilio",
    nodeKinds: [
      "twilio/create_message",
      "twilio/fetch_message",
      "twilio/list_messages",
      "twilio/create_call",
      "twilio/fetch_call",
      "twilio/list_calls",
    ],

    build(ctx: PluginContext): TwilioMethods {
      function resolveSid(sid: Expr<string> | string) {
        return ctx.isExpr(sid) ? sid.__node : ctx.lift(sid).__node;
      }

      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      // Build messages resource: callable + .create() + .list()
      // Mirrors twilio-node: client.messages(sid).fetch() AND client.messages.create(...)
      const messages = Object.assign(
        (sid: Expr<string> | string): TwilioMessageContext => ({
          fetch() {
            return ctx.expr({
              kind: "twilio/fetch_message",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/create_message",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/list_messages",
              params: params != null ? resolveParams(params) : null,
              config,
            });
          },
        },
      ) as TwilioMessagesResource;

      // Build calls resource: same pattern
      const calls = Object.assign(
        (sid: Expr<string> | string): TwilioCallContext => ({
          fetch() {
            return ctx.expr({
              kind: "twilio/fetch_call",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/create_call",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/list_calls",
              params: params != null ? resolveParams(params) : null,
              config,
            });
          },
        },
      ) as TwilioCallsResource;

      return {
        twilio: { messages, calls },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic CRUD operations:
//    Real:  const msg = await client.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//    Mvfm:   const msg = $.twilio.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const msg = $.twilio.messages.create({ to: $.input.to, body: $.input.body })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  client.messages.create(...)
//    Mvfm:   $.twilio.messages.create(...)
//    The nested resource pattern maps 1:1.
//
// WORKS GREAT (cont.):
//
// 4. Fetch by SID:
//    Real:  client.messages('SM123').fetch()
//    Mvfm:   $.twilio.messages('SM123').fetch()
//    1:1 match. Uses Object.assign to make messages both callable
//    and have .create()/.list() properties, just like twilio-node.
//
// 5. Return types:
//    Real twilio-node has typed response classes (MessageInstance,
//    CallInstance, etc.) with properties like .sid, .status, .body.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (msg.sid, call.status),
//    but no IDE autocomplete for Twilio-specific fields.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Auto-pagination:
//    Real:  client.messages.each({ pageSize: 20 }, (msg) => { ... })
//    Mvfm:   Can't model async iterators/callbacks.
//
// 7. Webhooks / status callbacks:
//    Server-initiated push events, not request/response.
//
// 8. TwiML generation:
//    XML construction — separate concern from REST API calls.
//
// ============================================================
```

**Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/plugins/twilio/5.5.1/index.test.ts`
Expected: PASS (all 12 tests)

**Step 6: Commit**

```bash
git add src/plugins/twilio/5.5.1/index.ts tests/plugins/twilio/5.5.1/index.test.ts
git commit -m "feat(twilio): add plugin definition and AST builder tests (#55)"
```

---

### Task 2: Interpreter fragment with tests

**Files:**
- Create: `src/plugins/twilio/5.5.1/interpreter.ts`
- Create: `tests/plugins/twilio/5.5.1/interpreter.test.ts`

**Step 1: Write the failing interpreter tests**

Create `tests/plugins/twilio/5.5.1/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { twilio } from "../../../../src/plugins/twilio/5.5.1";
import { twilioInterpreter } from "../../../../src/plugins/twilio/5.5.1/interpreter";

const app = mvfm(num, str, twilio({ accountSid: "AC_test_123", authToken: "auth_test_456" }));
const fragments = [twilioInterpreter, coreInterpreter];

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "twilio/api_call": async (effect) => {
      captured.push(effect);
      return { sid: "mock_sid", status: "mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Messages
// ============================================================

describe("twilio interpreter: create_message", () => {
  it("yields POST to Messages.json with correct params", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toEqual({
      to: "+15551234567",
      from: "+15559876543",
      body: "Hello",
    });
  });
});

describe("twilio interpreter: fetch_message", () => {
  it("yields GET to Messages/{Sid}.json", async () => {
    const prog = app(($) => $.twilio.messages("SM800f449d").fetch());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe(
      "/2010-04-01/Accounts/AC_test_123/Messages/SM800f449d.json",
    );
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_messages", () => {
  it("yields GET to Messages.json with params", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const prog = app(($) => $.twilio.messages.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Messages.json");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio interpreter: create_call", () => {
  it("yields POST to Calls.json with correct params", async () => {
    const prog = app(($) =>
      $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toEqual({
      to: "+15551234567",
      from: "+15559876543",
      url: "https://example.com/twiml",
    });
  });
});

describe("twilio interpreter: fetch_call", () => {
  it("yields GET to Calls/{Sid}.json", async () => {
    const prog = app(($) => $.twilio.calls("CA42ed11f9").fetch());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe(
      "/2010-04-01/Accounts/AC_test_123/Calls/CA42ed11f9.json",
    );
    expect(captured[0].params).toBeUndefined();
  });
});

describe("twilio interpreter: list_calls", () => {
  it("yields GET to Calls.json with params", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("twilio/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toEqual({ limit: 20 });
  });

  it("yields GET with undefined params when omitted", async () => {
    const prog = app(($) => $.twilio.calls.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/2010-04-01/Accounts/AC_test_123/Calls.json");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("twilio interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ to: "string", body: "string" }, ($) =>
      $.twilio.messages.create({
        to: $.input.to,
        from: "+15559876543",
        body: $.input.body,
      }),
    );
    const { captured } = await run(prog, { to: "+15551111111", body: "Dynamic message" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      to: "+15551111111",
      from: "+15559876543",
      body: "Dynamic message",
    });
  });

  it("resolves input sid for fetch", async () => {
    const prog = app({ msgSid: "string" }, ($) => $.twilio.messages($.input.msgSid).fetch());
    const { captured } = await run(prog, { msgSid: "SM_dynamic_789" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe(
      "/2010-04-01/Accounts/AC_test_123/Messages/SM_dynamic_789.json",
    );
  });
});

// ============================================================
// Return value
// ============================================================

describe("twilio interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.twilio.messages("SM_123").fetch());
    const { result } = await run(prog);
    expect(result).toEqual({ sid: "mock_sid", status: "mock" });
  });
});
```

**Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/plugins/twilio/5.5.1/interpreter.test.ts`
Expected: FAIL (module `interpreter` not found)

**Step 3: Write the interpreter**

Create `src/plugins/twilio/5.5.1/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Twilio client interface consumed by the twilio handler.
 *
 * Abstracts over the actual Twilio SDK so handlers can be
 * tested with mock clients.
 */
export interface TwilioClient {
  /** Execute a Twilio API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for twilio plugin nodes.
 *
 * Yields `twilio/api_call` effects for all 6 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Twilio REST API v2010 conventions.
 */
export const twilioInterpreter: InterpreterFragment = {
  pluginName: "twilio",
  canHandle: (node) => node.kind.startsWith("twilio/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const config = node.config as { accountSid: string; authToken: string };
    const base = `/2010-04-01/Accounts/${config.accountSid}`;

    switch (node.kind) {
      // ---- Messages ----

      case "twilio/create_message": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "POST",
          path: `${base}/Messages.json`,
          params,
        };
      }

      case "twilio/fetch_message": {
        const sid = yield { type: "recurse", child: node.sid as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Messages/${sid}.json`,
        };
      }

      case "twilio/list_messages": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Messages.json`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      // ---- Calls ----

      case "twilio/create_call": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "POST",
          path: `${base}/Calls.json`,
          params,
        };
      }

      case "twilio/fetch_call": {
        const sid = yield { type: "recurse", child: node.sid as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Calls/${sid}.json`,
        };
      }

      case "twilio/list_calls": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Calls.json`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      default:
        throw new Error(`Twilio interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/plugins/twilio/5.5.1/interpreter.test.ts`
Expected: PASS (all 10 tests)

**Step 5: Commit**

```bash
git add src/plugins/twilio/5.5.1/interpreter.ts tests/plugins/twilio/5.5.1/interpreter.test.ts
git commit -m "feat(twilio): add interpreter fragment with tests (#55)"
```

---

### Task 3: Server handler

**Files:**
- Create: `src/plugins/twilio/5.5.1/handler.server.ts`

**Step 1: Write the server handler**

Create `src/plugins/twilio/5.5.1/handler.server.ts`. This follows the exact same pattern as `src/plugins/stripe/2025-04-30.basil/handler.server.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { TwilioClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Twilio effects
 * against a real Twilio client.
 *
 * Handles `twilio/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: TwilioClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "twilio/api_call") {
      const { method, path, params } = effect as {
        type: "twilio/api_call";
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Twilio client using the provided interpreter fragments.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: TwilioClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors (or only pre-existing errors)

**Step 3: Commit**

```bash
git add src/plugins/twilio/5.5.1/handler.server.ts
git commit -m "feat(twilio): add server handler (#55)"
```

---

### Task 4: Client handler

**Files:**
- Create: `src/plugins/twilio/5.5.1/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/twilio/5.5.1/handler.client.ts`. This is identical in structure to the Stripe client handler:

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends effects as JSON
 * to a remote server endpoint for execution.
 *
 * Each effect is sent as a POST request to `{baseUrl}/mvfm/execute` with
 * the contract hash, step index, path, and effect payload. The server
 * is expected to return `{ result: unknown }` in the response body.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/mvfm/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add src/plugins/twilio/5.5.1/handler.client.ts
git commit -m "feat(twilio): add client handler (#55)"
```

---

### Task 5: SDK adapter

**Files:**
- Create: `src/plugins/twilio/5.5.1/client-twilio-sdk.ts`

**Step 1: Write the SDK adapter**

Create `src/plugins/twilio/5.5.1/client-twilio-sdk.ts`. The Twilio SDK uses a `Twilio` client with `request()` under the hood. The adapter wraps it into our `TwilioClient` interface:

```ts
import type Twilio from "twilio";
import type { TwilioClient } from "./interpreter";

type TwilioInstance = InstanceType<typeof Twilio>;

/**
 * Wraps the official Twilio SDK into a {@link TwilioClient}.
 *
 * Uses the SDK's underlying `httpClient.request()` to send requests,
 * preserving the SDK's built-in authentication and telemetry.
 *
 * For POST requests, params are sent as form-encoded body parameters.
 * For GET requests, params are encoded as query string parameters on the path.
 *
 * @param client - A configured Twilio SDK client instance.
 * @returns A {@link TwilioClient} adapter.
 */
export function wrapTwilioSdk(client: TwilioInstance): TwilioClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();
      const baseUrl = `https://api.twilio.com`;

      if (upperMethod === "POST") {
        const response = await client.request({
          method: "POST" as any,
          uri: `${baseUrl}${path}`,
          data: params ?? undefined,
        });
        return response.body;
      }

      // GET: encode params as query string
      let finalUri = `${baseUrl}${path}`;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        finalUri = `${finalUri}?${qs}`;
      }
      const response = await client.request({
        method: "GET" as any,
        uri: finalUri,
      });
      return response.body;
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project tsconfig.json`
Expected: No errors (the `twilio` package type may or may not be installed — if it's not a dependency, this will use `import type` which is fine for compilation. Check if `twilio` is in devDependencies. If not, use a more generic type.)

**Note:** If `twilio` is not in package.json, the adapter should use a structural interface instead of importing the Twilio type:

```ts
/**
 * Minimal interface for a Twilio SDK client instance.
 * This avoids requiring the `twilio` package as a dependency.
 */
interface TwilioSdkClient {
  request(opts: {
    method: string;
    uri: string;
    data?: Record<string, unknown>;
  }): Promise<{ body: unknown }>;
}
```

Check with: `grep '"twilio"' package.json`

**Step 3: Commit**

```bash
git add src/plugins/twilio/5.5.1/client-twilio-sdk.ts
git commit -m "feat(twilio): add SDK adapter (#55)"
```

---

### Task 6: Public exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Add twilio exports to `src/index.ts`**

Add the following block after the stripe exports (around line 93), following the exact same pattern:

```ts
export type { TwilioConfig, TwilioMethods } from "./plugins/twilio/5.5.1";
export { twilio } from "./plugins/twilio/5.5.1";
export { wrapTwilioSdk } from "./plugins/twilio/5.5.1/client-twilio-sdk";
export type {
  ClientHandlerOptions as TwilioClientHandlerOptions,
  ClientHandlerState as TwilioClientHandlerState,
} from "./plugins/twilio/5.5.1/handler.client";
export { clientHandler as twilioClientHandler } from "./plugins/twilio/5.5.1/handler.client";
export {
  serverEvaluate as twilioServerEvaluate,
  serverHandler as twilioServerHandler,
} from "./plugins/twilio/5.5.1/handler.server";
export type { TwilioClient } from "./plugins/twilio/5.5.1/interpreter";
export { twilioInterpreter } from "./plugins/twilio/5.5.1/interpreter";
```

**Step 2: Verify build passes**

Run: `npm run build && npm run check`
Expected: PASS

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass (existing 438 + new twilio tests)

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(twilio): add public exports (#55)"
```

---

### Task 7: Integration test (optional — depends on twilio SDK being available)

**Files:**
- Create: `tests/plugins/twilio/5.5.1/integration.test.ts`

**Note:** Twilio does not have an official mock server like Stripe. For integration tests, we use a mock TwilioClient directly (no container needed). This tests the full evaluation pipeline (AST → interpreter → handler → mock client) without a real Twilio account.

**Step 1: Write the integration test**

Create `tests/plugins/twilio/5.5.1/integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { twilio as twilioPlugin } from "../../../../src/plugins/twilio/5.5.1";
import { serverEvaluate } from "../../../../src/plugins/twilio/5.5.1/handler.server";
import { twilioInterpreter } from "../../../../src/plugins/twilio/5.5.1/interpreter";
import type { TwilioClient } from "../../../../src/plugins/twilio/5.5.1/interpreter";

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

const allFragments = [twilioInterpreter, coreInterpreter, numInterpreter, strInterpreter];

const app = mvfm(
  num,
  str,
  twilioPlugin({ accountSid: "AC_test_123", authToken: "auth_test_456" }),
);

/**
 * Mock Twilio client that returns canned responses based on method/path.
 */
function createMockClient(): TwilioClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      if (method === "POST" && path.includes("/Messages.json")) {
        return {
          sid: "SM_mock_123",
          status: "queued",
          to: params?.to ?? "+10000000000",
          from: params?.from ?? "+10000000001",
          body: params?.body ?? "",
        };
      }
      if (method === "GET" && path.includes("/Messages/")) {
        return { sid: "SM_mock_123", status: "delivered", body: "Hello" };
      }
      if (method === "GET" && path.includes("/Messages.json")) {
        return {
          messages: [
            { sid: "SM_1", status: "delivered" },
            { sid: "SM_2", status: "queued" },
          ],
        };
      }
      if (method === "POST" && path.includes("/Calls.json")) {
        return {
          sid: "CA_mock_456",
          status: "queued",
          to: params?.to ?? "+10000000000",
          from: params?.from ?? "+10000000001",
        };
      }
      if (method === "GET" && path.includes("/Calls/")) {
        return { sid: "CA_mock_456", status: "completed", duration: "42" };
      }
      if (method === "GET" && path.includes("/Calls.json")) {
        return {
          calls: [
            { sid: "CA_1", status: "completed" },
            { sid: "CA_2", status: "in-progress" },
          ],
        };
      }
      throw new Error(`Mock: unhandled ${method} ${path}`);
    },
  };
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

// ============================================================
// Messages
// ============================================================

describe("twilio integration: messages", () => {
  it("create message", async () => {
    const prog = app(($) =>
      $.twilio.messages.create({ to: "+15551234567", from: "+15559876543", body: "Hello" }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("SM_mock_123");
    expect(result.status).toBe("queued");
  });

  it("fetch message", async () => {
    const prog = app(($) => $.twilio.messages("SM_mock_123").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("SM_mock_123");
    expect(result.status).toBe("delivered");
  });

  it("list messages", async () => {
    const prog = app(($) => $.twilio.messages.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.messages).toHaveLength(2);
  });
});

// ============================================================
// Calls
// ============================================================

describe("twilio integration: calls", () => {
  it("create call", async () => {
    const prog = app(($) =>
      $.twilio.calls.create({
        to: "+15551234567",
        from: "+15559876543",
        url: "https://example.com/twiml",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("CA_mock_456");
    expect(result.status).toBe("queued");
  });

  it("fetch call", async () => {
    const prog = app(($) => $.twilio.calls("CA_mock_456").fetch());
    const result = (await run(prog)) as any;
    expect(result.sid).toBe("CA_mock_456");
    expect(result.status).toBe("completed");
  });

  it("list calls", async () => {
    const prog = app(($) => $.twilio.calls.list({ limit: 20 }));
    const result = (await run(prog)) as any;
    expect(result.calls).toHaveLength(2);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("twilio integration: chaining", () => {
  it("create message then fetch it by sid", async () => {
    const prog = app(($) => {
      const msg = $.twilio.messages.create({
        to: "+15551234567",
        from: "+15559876543",
        body: "Chain test",
      });
      return $.twilio.messages((msg as any).sid).fetch();
    });
    const result = (await run(prog)) as any;
    // The fetch uses the mock sid from the create response
    expect(result.sid).toBeDefined();
  });
});
```

**Step 2: Run the integration test**

Run: `npx vitest run tests/plugins/twilio/5.5.1/integration.test.ts`
Expected: PASS (7 tests)

**Step 3: Commit**

```bash
git add tests/plugins/twilio/5.5.1/integration.test.ts
git commit -m "feat(twilio): add integration tests with mock client (#55)"
```

---

### Task 8: Final validation and cleanup

**Step 1: Run the full build and test suite**

```bash
npm run build && npm run check && npm test
```

Expected: All pass.

**Step 2: Verify no lint issues**

```bash
npx biome check src/plugins/twilio/ tests/plugins/twilio/
```

Expected: No errors.

**Step 3: Final commit (if any formatting fixes needed)**

```bash
git add -A && git commit -m "chore(twilio): formatting fixes (#55)"
```

**Step 4: Create PR**

```bash
gh pr create --title "feat(twilio): add twilio plugin (#55)" --body "$(cat <<'EOF'
## Summary
- Implements the `twilio` plugin for issue #55 (parent: #46)
- Models twilio-node v5.5.1 with Messages (create/fetch/list) and Calls (create/fetch/list)
- Follows the Stripe plugin pattern: configured factory, uniform `twilio/api_call` effect
- Source-level analysis documented in index.ts header and design doc

Closes #55

## Design alignment
- Plugin follows `docs/plugin-authoring-guide.md` exactly: 3 required fields, namespaced node kinds, `Expr<T> | T` params with `ctx.lift()`, config baked into AST nodes
- External-service plugin at `src/plugins/twilio/5.5.1/` with all 5 required files
- Honest assessment in index.ts header documents what maps cleanly, what deviates, and what can't be modeled

## Validation performed
- `npm run build` — passes
- `npm run check` — passes
- `npm test` — all tests pass (existing + new twilio tests)
- AST construction tests verify correct node kinds and parameter lifting
- Interpreter tests verify correct REST method/path/params for all 6 operations
- Integration tests verify full evaluation pipeline with mock client

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
