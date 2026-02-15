# Resend Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `resend` plugin (resend-node v6.9.2) with emails.send, emails.get, batch.send, and contacts CRUD.

**Architecture:** Uniform `resend/api_call` effect type, identical to the Stripe plugin pattern. Factory function with `ResendConfig { apiKey }`. SDK adapter wraps the real Resend class into a `ResendClient.request(method, path, params?)` interface.

**Tech Stack:** TypeScript, vitest, resend-node SDK

**Reference files:** The Stripe plugin is the direct template:
- `src/plugins/stripe/2025-04-30.basil/index.ts` — plugin definition pattern
- `src/plugins/stripe/2025-04-30.basil/interpreter.ts` — interpreter pattern
- `src/plugins/stripe/2025-04-30.basil/handler.server.ts` — server handler pattern
- `src/plugins/stripe/2025-04-30.basil/handler.client.ts` — client handler pattern
- `src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts` — SDK adapter pattern
- `tests/plugins/stripe/2025-04-30.basil/` — all three test tiers

---

### Task 1: Create worktree and directory structure

**Step 1: Create worktree**

```bash
git worktree add ../ilo-51 -b issue-51
```

**Step 2: Assign the issue**

```bash
gh issue edit 51 --add-assignee @me --remove-label ready --add-label in-progress
```

**Step 3: Create directory structure**

```bash
mkdir -p ../ilo-51/src/plugins/resend/6.9.2
mkdir -p ../ilo-51/tests/plugins/resend/6.9.2
```

**Step 4: Commit**

```bash
cd ../ilo-51
git add -A && git commit -m "chore: scaffold resend plugin directory structure (#51)"
```

---

### Task 2: Plugin definition (`index.ts`)

**Files:**
- Create: `src/plugins/resend/6.9.2/index.ts`

**Step 1: Write the failing test**

Create `tests/plugins/resend/6.9.2/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { resend } from "../../../../src/plugins/resend/6.9.2";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, resend({ apiKey: "re_test_123" }));

// ============================================================
// Emails
// ============================================================

describe("resend: emails.send", () => {
  it("produces resend/send_email node with params", () => {
    const prog = app(($) => {
      return $.resend.emails.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_email");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.from.value).toBe("sender@example.com");
    expect(ast.result.params.fields.to.value).toBe("recipient@example.com");
    expect(ast.result.params.fields.subject.value).toBe("Hello");
    expect(ast.result.params.fields.html.value).toBe("<p>World</p>");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.resend.emails.send({
        from: "sender@example.com",
        to: $.input.recipientEmail,
        subject: $.input.subject,
        html: $.input.body,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_email");
    expect(ast.result.params.fields.to.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.subject.kind).toBe("core/prop_access");
  });
});

describe("resend: emails.get", () => {
  it("produces resend/get_email node with literal id", () => {
    const prog = app(($) => {
      return $.resend.emails.get("email_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_email");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("email_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.resend.emails.get($.input.emailId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_email");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend: batch.send", () => {
  it("produces resend/send_batch node with params", () => {
    const prog = app(($) => {
      return $.resend.batch.send([
        { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
        { from: "a@example.com", to: "c@example.com", subject: "Two", html: "<p>2</p>" },
      ]);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/send_batch");
    expect(ast.result.params.kind).toBe("core/tuple");
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend: contacts.create", () => {
  it("produces resend/create_contact node with params", () => {
    const prog = app(($) => {
      return $.resend.contacts.create({ email: "user@example.com" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/create_contact");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.email.value).toBe("user@example.com");
  });
});

describe("resend: contacts.get", () => {
  it("produces resend/get_contact node with literal id", () => {
    const prog = app(($) => {
      return $.resend.contacts.get("contact_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/get_contact");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("contact_123");
  });
});

describe("resend: contacts.list", () => {
  it("produces resend/list_contacts node", () => {
    const prog = app(($) => {
      return $.resend.contacts.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/list_contacts");
  });
});

describe("resend: contacts.remove", () => {
  it("produces resend/remove_contact node with literal id", () => {
    const prog = app(($) => {
      return $.resend.contacts.remove("contact_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("resend/remove_contact");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("contact_123");
  });
});

// ============================================================
// $.do() integration
// ============================================================

describe("resend: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const email = $.resend.emails.send({
          from: "a@example.com",
          to: "b@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
        });
        const contact = $.resend.contacts.create({ email: "user@example.com" });
        return $.do(email, contact);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const email = $.resend.emails.get("email_123");
        $.resend.contacts.create({ email: "orphan@example.com" }); // orphan!
        return email;
      });
    }).toThrow(/unreachable node/i);
  });
});

// ============================================================
// Cross-operation dependencies
// ============================================================

describe("resend: cross-operation dependencies", () => {
  it("can use result of send as input to get", () => {
    const prog = app(($) => {
      const sent = $.resend.emails.send({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
      });
      return $.resend.emails.get((sent as any).id);
    });
    const ast = strip(prog.ast) as any;
    // The get's id should reference the send result via prop_access
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `.venv/bin/python -c "pass"` is N/A — this is TypeScript.
Run: `npm test -- --run tests/plugins/resend/6.9.2/index.test.ts`
Expected: FAIL — module not found (resend plugin doesn't exist yet)

**Step 3: Write the plugin definition**

Create `src/plugins/resend/6.9.2/index.ts` — follow the Stripe pattern exactly:

```ts
// ============================================================
// ILO PLUGIN: resend (resend-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (3 of 11 resources)
// Plugin size: MEDIUM — at pass 1 of 75/25 split
//
// Implemented:
//   - Emails: send, get
//   - Batch: send
//   - Contacts: create, get, list, remove
//
// Not doable (fundamental mismatch with AST model):
//   - Webhooks: push-based, not request-response
//   - React email rendering: build-time side effect (use html instead)
//
// Remaining (same pattern, add as needed):
//   - Emails: cancel, update, list
//   - Domains: create, get, list, update, remove, verify
//   - Segments: create, get, list, remove
//   - Broadcasts: create, send, get, list, update, remove
//   - ApiKeys: create, list, remove
//   - Templates, Topics, ContactProperties
//
// Goal: An LLM that knows resend-node should be able to write
// Ilo programs with near-zero learning curve.
//
// Real resend-node API (v6.9.2):
//   const resend = new Resend('re_123')
//   await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//   await resend.emails.get('email_id')
//   await resend.batch.send([{ from: '...', to: '...', subject: '...', html: '...' }])
//   await resend.contacts.create({ email: '...' })
//   await resend.contacts.get('contact_id')
//   await resend.contacts.list()
//   await resend.contacts.remove('contact_id')
//
// Based on source-level analysis of resend-node
// (github.com/resend/resend-node). The SDK uses a Resend class
// with resource properties (emails, batch, contacts, etc.) that
// delegate to fetchRequest() for all HTTP operations.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Resend operations added to the DSL context by the resend plugin.
 *
 * Mirrors the resend-node SDK resource API: emails, batch, and contacts.
 * Each resource exposes methods that produce namespaced AST nodes.
 */
export interface ResendMethods {
  /** Resend API operations, namespaced under `$.resend`. */
  resend: {
    emails: {
      /** Send an email. Mirrors `resend.emails.send()`. */
      send(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get an email by ID. Mirrors `resend.emails.get()`. */
      get(id: Expr<string> | string): Expr<Record<string, unknown>>;
    };
    batch: {
      /** Send a batch of emails. Mirrors `resend.batch.send()`. */
      send(
        params:
          | Expr<Record<string, unknown>[]>
          | Record<string, unknown>[],
      ): Expr<Record<string, unknown>>;
    };
    contacts: {
      /** Create a contact. Mirrors `resend.contacts.create()`. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get a contact by ID. Mirrors `resend.contacts.get()`. */
      get(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** List all contacts. Mirrors `resend.contacts.list()`. */
      list(): Expr<Record<string, unknown>>;
      /** Remove a contact by ID. Mirrors `resend.contacts.remove()`. */
      remove(id: Expr<string> | string): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the resend plugin.
 *
 * Requires an API key from the Resend dashboard.
 */
export interface ResendConfig {
  /** Resend API key (e.g. `re_123...`). */
  apiKey: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Resend plugin factory. Namespace: `resend/`.
 *
 * Creates a plugin that exposes email, batch, and contact methods
 * for building parameterized Resend API call AST nodes.
 *
 * @param config - A {@link ResendConfig} with apiKey.
 * @returns A {@link PluginDefinition} for the resend plugin.
 */
export function resend(config: ResendConfig): PluginDefinition<ResendMethods> {
  return {
    name: "resend",
    nodeKinds: [
      "resend/send_email",
      "resend/get_email",
      "resend/send_batch",
      "resend/create_contact",
      "resend/get_contact",
      "resend/list_contacts",
      "resend/remove_contact",
    ],

    build(ctx: PluginContext): ResendMethods {
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      function resolveParams(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ) {
        return ctx.lift(params).__node;
      }

      return {
        resend: {
          emails: {
            send(params) {
              return ctx.expr({
                kind: "resend/send_email",
                params: resolveParams(params),
                config,
              });
            },
            get(id) {
              return ctx.expr({
                kind: "resend/get_email",
                id: resolveId(id),
                config,
              });
            },
          },
          batch: {
            send(params) {
              return ctx.expr({
                kind: "resend/send_batch",
                params: ctx.lift(params).__node,
                config,
              });
            },
          },
          contacts: {
            create(params) {
              return ctx.expr({
                kind: "resend/create_contact",
                params: resolveParams(params),
                config,
              });
            },
            get(id) {
              return ctx.expr({
                kind: "resend/get_contact",
                id: resolveId(id),
                config,
              });
            },
            list() {
              return ctx.expr({
                kind: "resend/list_contacts",
                config,
              });
            },
            remove(id) {
              return ctx.expr({
                kind: "resend/remove_contact",
                id: resolveId(id),
                config,
              });
            },
          },
        },
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
// 1. Basic email sending:
//    Real:  await resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//    Ilo:   $.resend.emails.send({ from: '...', to: '...', subject: '...', html: '...' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const email = $.resend.emails.send({ to: $.input.recipient, subject: $.input.subject, ... })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Contact management:
//    Real:  await resend.contacts.create({ email: '...' })
//    Ilo:   $.resend.contacts.create({ email: '...' })
//    1:1 mapping.
//
// 4. Batch sending:
//    Real:  await resend.batch.send([{ from: '...', to: '...' }, ...])
//    Ilo:   $.resend.batch.send([{ from: '...', to: '...' }, ...])
//    Array of emails maps to core/tuple AST node.
//
// WORKS BUT DIFFERENT:
//
// 5. React email templates:
//    Real:  resend.emails.send({ react: <MyTemplate /> })
//    Ilo:   Not supported. Use html or text instead.
//    React rendering is a build-time side effect that can't be
//    modeled in the AST.
//
// 6. Return types:
//    Real:  Returns typed { data: { id: string }, error: null }
//    Ilo:   Returns Record<string, unknown> (data only, unwrapped).
//    The SDK adapter strips the { data, error } envelope.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Webhooks: Push-based events, not request-response.
// 8. Attachments with Buffer content: Binary data in AST is awkward.
//    Path-based attachments via URL would work.
// 9. Idempotency keys: Not modeled yet (could add as AST field).
//
// SUMMARY:
// For the core use case of "send emails, manage contacts" —
// nearly identical to real resend-node. The main gap is React
// email templates (use html instead) and typed response objects.
// ============================================================
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/resend/6.9.2/index.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/resend/6.9.2/index.ts tests/plugins/resend/6.9.2/index.test.ts
git commit -m "feat(resend): add plugin definition and AST construction tests (#51)"
```

---

### Task 3: Interpreter (`interpreter.ts`)

**Files:**
- Create: `src/plugins/resend/6.9.2/interpreter.ts`
- Create: `tests/plugins/resend/6.9.2/interpreter.test.ts`

**Step 1: Write the failing test**

Create `tests/plugins/resend/6.9.2/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { resend } from "../../../../src/plugins/resend/6.9.2";
import { resendInterpreter } from "../../../../src/plugins/resend/6.9.2/interpreter";

const app = ilo(num, str, resend({ apiKey: "re_test_123" }));
const fragments = [resendInterpreter, coreInterpreter];

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
    "resend/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Emails
// ============================================================

describe("resend interpreter: send_email", () => {
  it("yields POST /emails with correct params", async () => {
    const prog = app(($) =>
      $.resend.emails.send({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Hi",
        html: "<p>Hello</p>",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/emails");
    expect(captured[0].params).toEqual({
      from: "a@example.com",
      to: "b@example.com",
      subject: "Hi",
      html: "<p>Hello</p>",
    });
  });
});

describe("resend interpreter: get_email", () => {
  it("yields GET /emails/{id}", async () => {
    const prog = app(($) => $.resend.emails.get("email_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/emails/email_123");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend interpreter: send_batch", () => {
  it("yields POST /emails/batch with array params", async () => {
    const prog = app(($) =>
      $.resend.batch.send([
        { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
      ]),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/emails/batch");
    expect(captured[0].params).toEqual([
      { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
    ]);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend interpreter: create_contact", () => {
  it("yields POST /contacts with correct params", async () => {
    const prog = app(($) =>
      $.resend.contacts.create({ email: "user@example.com" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toEqual({ email: "user@example.com" });
  });
});

describe("resend interpreter: get_contact", () => {
  it("yields GET /contacts/{id}", async () => {
    const prog = app(($) => $.resend.contacts.get("contact_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts/contact_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: list_contacts", () => {
  it("yields GET /contacts", async () => {
    const prog = app(($) => $.resend.contacts.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/contacts");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("resend interpreter: remove_contact", () => {
  it("yields DELETE /contacts/{id}", async () => {
    const prog = app(($) => $.resend.contacts.remove("contact_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("resend/api_call");
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/contacts/contact_123");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("resend interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ to: "string", subject: "string" }, ($) =>
      $.resend.emails.send({
        from: "sender@example.com",
        to: $.input.to,
        subject: $.input.subject,
        html: "<p>Hi</p>",
      }),
    );
    const { captured } = await run(prog, {
      to: "dynamic@example.com",
      subject: "Dynamic Subject",
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({
      from: "sender@example.com",
      to: "dynamic@example.com",
      subject: "Dynamic Subject",
      html: "<p>Hi</p>",
    });
  });

  it("resolves input id for get", async () => {
    const prog = app({ emailId: "string" }, ($) =>
      $.resend.emails.get($.input.emailId),
    );
    const { captured } = await run(prog, { emailId: "email_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/emails/email_dynamic_456");
  });
});

// ============================================================
// Mock return value
// ============================================================

describe("resend interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.resend.emails.get("email_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/plugins/resend/6.9.2/interpreter.test.ts`
Expected: FAIL — interpreter module not found

**Step 3: Write the interpreter**

Create `src/plugins/resend/6.9.2/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Resend client interface consumed by the resend handler.
 *
 * Abstracts over the actual Resend SDK so handlers can be
 * tested with mock clients.
 */
export interface ResendClient {
  /** Execute a Resend API request and return the parsed response. */
  request(method: string, path: string, params?: unknown): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for resend plugin nodes.
 *
 * Yields `resend/api_call` effects for all 7 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Resend REST API conventions.
 */
export const resendInterpreter: InterpreterFragment = {
  pluginName: "resend",
  canHandle: (node) => node.kind.startsWith("resend/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Emails ----

      case "resend/send_email": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/emails",
          params,
        };
      }

      case "resend/get_email": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: `/emails/${id}`,
        };
      }

      // ---- Batch ----

      case "resend/send_batch": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/emails/batch",
          params,
        };
      }

      // ---- Contacts ----

      case "resend/create_contact": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/contacts",
          params,
        };
      }

      case "resend/get_contact": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: `/contacts/${id}`,
        };
      }

      case "resend/list_contacts": {
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: "/contacts",
        };
      }

      case "resend/remove_contact": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "DELETE",
          path: `/contacts/${id}`,
        };
      }

      default:
        throw new Error(`Resend interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/resend/6.9.2/interpreter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/resend/6.9.2/interpreter.ts tests/plugins/resend/6.9.2/interpreter.test.ts
git commit -m "feat(resend): add interpreter fragment with resend/api_call effect (#51)"
```

---

### Task 4: Server handler (`handler.server.ts`)

**Files:**
- Create: `src/plugins/resend/6.9.2/handler.server.ts`

**Step 1: Write the server handler**

Create `src/plugins/resend/6.9.2/handler.server.ts` — identical pattern to Stripe:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { ResendClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Resend effects
 * against a real Resend client.
 *
 * Handles `resend/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: ResendClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "resend/api_call") {
      const { method, path, params } = effect as {
        type: "resend/api_call";
        method: string;
        path: string;
        params?: unknown;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Resend client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: ResendClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/plugins/resend/6.9.2/handler.server.ts
git commit -m "feat(resend): add server handler and serverEvaluate (#51)"
```

---

### Task 5: Client handler (`handler.client.ts`)

**Files:**
- Create: `src/plugins/resend/6.9.2/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/resend/6.9.2/handler.client.ts` — identical to Stripe:

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
 * Each effect is sent as a POST request to `{baseUrl}/ilo/execute` with
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
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
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

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/plugins/resend/6.9.2/handler.client.ts
git commit -m "feat(resend): add client handler (#51)"
```

---

### Task 6: SDK adapter (`client-resend-sdk.ts`)

**Files:**
- Create: `src/plugins/resend/6.9.2/client-resend-sdk.ts`

**Step 1: Write the SDK adapter**

Create `src/plugins/resend/6.9.2/client-resend-sdk.ts`:

The Resend SDK uses `resend.post()`, `resend.get()`, `resend.delete()` methods. Each returns `{ data, error, headers }`. The adapter unwraps this envelope.

```ts
import type { Resend } from "resend";
import type { ResendClient } from "./interpreter";

/**
 * Wraps the official Resend SDK into a {@link ResendClient}.
 *
 * Routes requests to `resend.post()`, `resend.get()`, or `resend.delete()`
 * based on the HTTP method. Unwraps the `{ data, error }` envelope:
 * returns `data` on success, throws on error.
 *
 * @param resend - A configured Resend SDK instance.
 * @returns A {@link ResendClient} adapter.
 */
export function wrapResendSdk(resend: Resend): ResendClient {
  return {
    async request(
      method: string,
      path: string,
      params?: unknown,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      let response: { data: unknown; error: unknown };

      switch (upperMethod) {
        case "POST":
          response = await resend.post(path, params);
          break;
        case "GET":
          response = await resend.get(path);
          break;
        case "DELETE":
          response = await resend.delete(path);
          break;
        case "PATCH":
          response = await resend.patch(path, params);
          break;
        default:
          throw new Error(`wrapResendSdk: unsupported method "${method}"`);
      }

      if (response.error) {
        throw new Error(
          typeof response.error === "object" && response.error !== null && "message" in response.error
            ? String((response.error as { message: string }).message)
            : `Resend API error on ${upperMethod} ${path}`,
        );
      }

      return response.data;
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: No errors (note: `resend` is a peer/optional dependency — the import type is fine)

**Step 3: Commit**

```bash
git add src/plugins/resend/6.9.2/client-resend-sdk.ts
git commit -m "feat(resend): add SDK adapter wrapping resend-node (#51)"
```

---

### Task 7: Public exports in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Step 1: Add resend exports**

Add the following exports to `src/index.ts`, following the Stripe export pattern:

```ts
// Resend (resend-node compatible)
export type { ResendConfig, ResendMethods } from "./plugins/resend/6.9.2";
export { resend } from "./plugins/resend/6.9.2";
export { wrapResendSdk } from "./plugins/resend/6.9.2/client-resend-sdk";
export type {
  ClientHandlerOptions as ResendClientHandlerOptions,
  ClientHandlerState as ResendClientHandlerState,
} from "./plugins/resend/6.9.2/handler.client";
export { clientHandler as resendClientHandler } from "./plugins/resend/6.9.2/handler.client";
export {
  serverEvaluate as resendServerEvaluate,
  serverHandler as resendServerHandler,
} from "./plugins/resend/6.9.2/handler.server";
export type { ResendClient } from "./plugins/resend/6.9.2/interpreter";
export { resendInterpreter } from "./plugins/resend/6.9.2/interpreter";
```

**Step 2: Run full build + check**

Run: `npm run build && npm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(resend): add public exports to src/index.ts (#51)"
```

---

### Task 8: Integration test

**Files:**
- Create: `tests/plugins/resend/6.9.2/integration.test.ts`

**Step 1: Write the integration test**

No official Resend mock container exists. Use a simple HTTP mock server (Node's built-in `http` module) that accepts requests and returns canned responses:

```ts
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { resend as resendPlugin } from "../../../../src/plugins/resend/6.9.2";
import { serverEvaluate } from "../../../../src/plugins/resend/6.9.2/handler.server";
import { resendInterpreter } from "../../../../src/plugins/resend/6.9.2/interpreter";
import type { ResendClient } from "../../../../src/plugins/resend/6.9.2/interpreter";

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

// Simple mock Resend API server
let server: http.Server;
let port: number;

const allFragments = [resendInterpreter, coreInterpreter, numInterpreter, strInterpreter];
const app = ilo(num, str, resendPlugin({ apiKey: "re_test_fake" }));

function createMockClient(): ResendClient {
  return {
    async request(method: string, path: string, params?: unknown): Promise<unknown> {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(params !== undefined ? { body: JSON.stringify(params) } : {}),
      });
      return response.json();
    },
  };
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      // Route mock responses based on method + path
      if (req.method === "POST" && req.url === "/emails") {
        res.end(JSON.stringify({ id: "email_mock_001", object: "email" }));
      } else if (req.method === "GET" && req.url?.startsWith("/emails/")) {
        const id = req.url.split("/emails/")[1];
        res.end(JSON.stringify({ id, object: "email", from: "sender@example.com", to: ["recipient@example.com"], subject: "Test", created_at: "2026-01-01T00:00:00Z" }));
      } else if (req.method === "POST" && req.url === "/emails/batch") {
        const emails = JSON.parse(body || "[]");
        res.end(JSON.stringify({ data: emails.map((_: unknown, i: number) => ({ id: `email_batch_${i}` })) }));
      } else if (req.method === "POST" && req.url === "/contacts") {
        res.end(JSON.stringify({ id: "contact_mock_001", object: "contact" }));
      } else if (req.method === "GET" && req.url?.startsWith("/contacts/")) {
        const id = req.url.split("/contacts/")[1];
        res.end(JSON.stringify({ id, object: "contact", email: "user@example.com" }));
      } else if (req.method === "GET" && req.url === "/contacts") {
        res.end(JSON.stringify({ object: "list", data: [{ id: "contact_1", email: "a@example.com" }] }));
      } else if (req.method === "DELETE" && req.url?.startsWith("/contacts/")) {
        res.end(JSON.stringify({ object: "contact", id: "contact_mock_001", deleted: true }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not found" }));
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ============================================================
// Emails
// ============================================================

describe("resend integration: emails", () => {
  it("send email", async () => {
    const prog = app(($) =>
      $.resend.emails.send({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>World</p>",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_mock_001");
    expect(result.object).toBe("email");
  });

  it("get email", async () => {
    const prog = app(($) => $.resend.emails.get("email_abc"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("email_abc");
    expect(result.object).toBe("email");
  });
});

// ============================================================
// Batch
// ============================================================

describe("resend integration: batch", () => {
  it("send batch", async () => {
    const prog = app(($) =>
      $.resend.batch.send([
        { from: "a@example.com", to: "b@example.com", subject: "One", html: "<p>1</p>" },
        { from: "a@example.com", to: "c@example.com", subject: "Two", html: "<p>2</p>" },
      ]),
    );
    const result = (await run(prog)) as any;
    expect(result.data).toHaveLength(2);
  });
});

// ============================================================
// Contacts
// ============================================================

describe("resend integration: contacts", () => {
  it("create contact", async () => {
    const prog = app(($) =>
      $.resend.contacts.create({ email: "user@example.com" }),
    );
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_mock_001");
  });

  it("get contact", async () => {
    const prog = app(($) => $.resend.contacts.get("contact_xyz"));
    const result = (await run(prog)) as any;
    expect(result.id).toBe("contact_xyz");
    expect(result.email).toBe("user@example.com");
  });

  it("list contacts", async () => {
    const prog = app(($) => $.resend.contacts.list());
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("remove contact", async () => {
    const prog = app(($) => $.resend.contacts.remove("contact_del"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Chaining
// ============================================================

describe("resend integration: chaining", () => {
  it("send email then get it by id", async () => {
    const prog = app(($) => {
      const sent = $.resend.emails.send({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Chain",
        html: "<p>Test</p>",
      });
      return $.resend.emails.get((sent as any).id);
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("email");
  });
});
```

**Step 2: Run the integration test**

Run: `npm test -- --run tests/plugins/resend/6.9.2/integration.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/plugins/resend/6.9.2/integration.test.ts
git commit -m "feat(resend): add integration tests with mock HTTP server (#51)"
```

---

### Task 9: Full validation and PR

**Step 1: Run full test suite**

Run: `npm run build && npm run check && npm test`
Expected: ALL PASS, no type errors, no lint errors

**Step 2: Create PR**

```bash
gh pr create --title "feat: resend plugin (resend-node v6.9.2)" --body "$(cat <<'EOF'
## Summary

Closes #51

- Implements the `resend` plugin modeling resend-node v6.9.2
- **Emails:** send, get
- **Batch:** send
- **Contacts:** create, get, list, remove
- Plugin size: MEDIUM — pass 1 of 75/25 split (7 operations, 3 of 11 resources)
- Uniform `resend/api_call` effect type (same pattern as Stripe)

**Design alignment:** Follows `docs/plugin-authoring-guide.md` exactly. Three fields (`name`, `nodeKinds`, `build`). All node kinds namespaced as `resend/*`. Config baked into AST nodes. Source-level analysis performed on resend-node repo.

**Validation performed:** `npm run build`, `npm run check`, `npm test`. All three test tiers pass: AST construction, interpreter effects, integration against mock HTTP server.

## Test plan

- [x] Tier 1: AST construction tests verify correct node kinds and structure
- [x] Tier 2: Interpreter tests verify correct effect method/path/params
- [x] Tier 3: Integration tests verify full pipeline against mock HTTP server
- [x] Type-check passes (`npm run build && npm run check`)
- [x] All existing tests still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Watch CI**

```bash
gh pr checks <N> --watch
```
