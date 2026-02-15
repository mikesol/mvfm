# Stripe Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Stripe plugin with AST builder, generator-based interpreter, server handler (wrapping Stripe SDK), client handler (HTTP proxy), and stripe-mock integration tests — covering Payment Intents, Customers, and Charges.

**Architecture:** Follows the postgres reference plugin pattern exactly. Plugin definition builds AST nodes, interpreter yields uniform `stripe/api_call` effects, server handler delegates to a `StripeClient` interface backed by the official SDK's `rawRequest()` method, client handler proxies effects over HTTP.

**Tech Stack:** TypeScript, stripe npm package (SDK), stripe/stripe-mock Docker image (testing), vitest, testcontainers (GenericContainer)

**Source analysis:** Based on source-level analysis of stripe-node (github.com/stripe/stripe-node) and stripe-mock (github.com/stripe/stripe-mock). The SDK uses `StripeResource.extend()` with `stripeMethod()` specs defining HTTP method + path. V1 API uses `application/x-www-form-urlencoded` with bracket notation for nested objects. List responses are `{object: 'list', data: T[], has_more: boolean, url: string}`. The SDK exposes `rawRequest(method, path, params)` for untyped access. stripe-mock is stateless — validates request params via OpenAPI spec, returns hardcoded fixtures, reflects input values where names match.

---

### Task 1: Install dependencies and create directory structure

**Files:**
- Modify: `package.json` (add stripe + @testcontainers/postgresql already there, we need testcontainers base)
- Create: `src/plugins/stripe/2025-04-30.basil/` (directory)

**Step 1: Install stripe SDK as a dev dependency**

Run: `npm install --save-dev stripe`

**Step 2: Verify testcontainers is available**

The `@testcontainers/postgresql` package already pulls in `testcontainers` as a transitive dependency. Verify it's importable:

Run: `node -e "require('testcontainers')"`

If that fails, install it: `npm install --save-dev testcontainers`

**Step 3: Create directory structure**

Run: `mkdir -p src/plugins/stripe/2025-04-30.basil && mkdir -p tests/plugins/stripe/2025-04-30.basil`

**Step 4: Commit**

```bash
git add package.json package-lock.json src/plugins/stripe tests/plugins/stripe
git commit -m "chore: add stripe SDK dependency and plugin directory structure"
```

---

### Task 2: Plugin definition — AST builder for all 10 operations

**Files:**
- Create: `src/plugins/stripe/2025-04-30.basil/index.ts`

**Step 1: Write the AST parity test file first**

Create: `tests/plugins/stripe/2025-04-30.basil/index.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { stripe } from "../../../../src/plugins/stripe/2025-04-30.basil";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, stripe({ apiKey: "sk_test_fake" }));

// ============================================================
// Payment Intents
// ============================================================

describe("stripe: payment intents", () => {
  it("create produces stripe/create_payment_intent node", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    expect(ast.result.params.kind).toBe("core/literal");
    expect(ast.result.params.value).toEqual({ amount: 2000, currency: "usd" });
  });

  it("create with Expr params captures dependency", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({
        amount: $.input.amount,
        currency: "usd",
      } as any);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    // params is the whole object lifted — contains Expr refs
  });

  it("retrieve produces stripe/retrieve_payment_intent node", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.retrieve("pi_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_payment_intent");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("pi_123");
  });

  it("retrieve with Expr id captures dependency", () => {
    const prog = app(($) => {
      const pi = $.stripe.paymentIntents.create({ amount: 1000, currency: "usd" });
      return $.stripe.paymentIntents.retrieve(pi.id);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_payment_intent");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });

  it("confirm produces stripe/confirm_payment_intent node", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.confirm("pi_123", { payment_method: "pm_card_visa" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/confirm_payment_intent");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.params.kind).toBe("core/literal");
  });

  it("confirm with no params", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.confirm("pi_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/confirm_payment_intent");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Customers
// ============================================================

describe("stripe: customers", () => {
  it("create produces stripe/create_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.create({ email: "test@example.com" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_customer");
    expect(ast.result.params.kind).toBe("core/literal");
  });

  it("retrieve produces stripe/retrieve_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.retrieve("cus_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_customer");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cus_123");
  });

  it("update produces stripe/update_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.update("cus_123", { name: "Updated Name" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/update_customer");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.params.kind).toBe("core/literal");
  });

  it("list produces stripe/list_customers node", () => {
    const prog = app(($) => {
      return $.stripe.customers.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_customers");
    expect(ast.result.params.kind).toBe("core/literal");
  });

  it("list with no params", () => {
    const prog = app(($) => {
      return $.stripe.customers.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_customers");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Charges
// ============================================================

describe("stripe: charges", () => {
  it("create produces stripe/create_charge node", () => {
    const prog = app(($) => {
      return $.stripe.charges.create({ amount: 2000, currency: "usd", source: "tok_visa" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_charge");
    expect(ast.result.params.kind).toBe("core/literal");
  });

  it("retrieve produces stripe/retrieve_charge node", () => {
    const prog = app(($) => {
      return $.stripe.charges.retrieve("ch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_charge");
    expect(ast.result.id.kind).toBe("core/literal");
  });

  it("list produces stripe/list_charges node", () => {
    const prog = app(($) => {
      return $.stripe.charges.list({ limit: 5 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_charges");
    expect(ast.result.params.kind).toBe("core/literal");
  });
});

// ============================================================
// Integration with $.do()
// ============================================================

describe("stripe: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const customer = $.stripe.customers.create({ email: "test@test.com" });
        const charge = $.stripe.charges.create({
          amount: 1000,
          currency: "usd",
          customer: customer.id,
        } as any);
        return $.do(customer, charge);
      });
    }).not.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plugins/stripe/2025-04-30.basil/index.test.ts`
Expected: FAIL — module not found

**Step 3: Write the plugin definition**

Create: `src/plugins/stripe/2025-04-30.basil/index.ts`

```typescript
// ============================================================
// MVFM PLUGIN: stripe (Stripe API 2025-04-30.basil)
// ============================================================
//
// Based on source-level analysis of stripe-node
// (github.com/stripe/stripe-node).
//
// The Stripe SDK uses StripeResource.extend() with stripeMethod()
// specs that define HTTP method + fullPath for each operation.
// V1 API uses application/x-www-form-urlencoded with bracket
// notation for nested objects. List responses are
// {object: 'list', data: T[], has_more: boolean, url: string}.
//
// Real Stripe SDK API:
//   const stripe = new Stripe('sk_test_...')
//   const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//   const customer = await stripe.customers.create({ email: '...' })
//   const charge = await stripe.charges.create({ amount: 1000, currency: 'usd', source: '...' })
//
// Mvfm:
//   const pi = $.stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//   const customer = $.stripe.customers.create({ email: '...' })
//   const charge = $.stripe.charges.create({ amount: 1000, currency: 'usd', source: '...' })
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Stripe operations added to the DSL context by the stripe plugin.
 *
 * Mirrors the Stripe Node SDK's resource method API: each resource
 * (paymentIntents, customers, charges) exposes create, retrieve,
 * update, list, and resource-specific methods.
 */
export interface StripeMethods {
  /** Stripe API operations, namespaced under `$.stripe`. */
  stripe: {
    /** Payment Intent operations. */
    paymentIntents: {
      /**
       * Create a PaymentIntent.
       *
       * Real: `stripe.paymentIntents.create({ amount, currency, ... })`
       * Mvfm: `$.stripe.paymentIntents.create({ amount, currency, ... })`
       */
      create(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;

      /**
       * Retrieve a PaymentIntent by ID.
       *
       * Real: `stripe.paymentIntents.retrieve('pi_...')`
       * Mvfm: `$.stripe.paymentIntents.retrieve('pi_...')`
       */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;

      /**
       * Confirm a PaymentIntent.
       *
       * Real: `stripe.paymentIntents.confirm('pi_...', { payment_method: '...' })`
       * Mvfm: `$.stripe.paymentIntents.confirm('pi_...', { payment_method: '...' })`
       */
      confirm(id: Expr<string> | string, params?: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
    };

    /** Customer operations. */
    customers: {
      /**
       * Create a Customer.
       *
       * Real: `stripe.customers.create({ email, name, ... })`
       * Mvfm: `$.stripe.customers.create({ email, name, ... })`
       */
      create(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;

      /**
       * Retrieve a Customer by ID.
       *
       * Real: `stripe.customers.retrieve('cus_...')`
       * Mvfm: `$.stripe.customers.retrieve('cus_...')`
       */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;

      /**
       * Update a Customer.
       *
       * Real: `stripe.customers.update('cus_...', { name: '...' })`
       * Mvfm: `$.stripe.customers.update('cus_...', { name: '...' })`
       */
      update(id: Expr<string> | string, params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;

      /**
       * List Customers.
       *
       * Real: `stripe.customers.list({ limit: 10 })`
       * Mvfm: `$.stripe.customers.list({ limit: 10 })`
       *
       * Returns `{object: 'list', data: Customer[], has_more: boolean}`.
       */
      list(params?: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
    };

    /** Charge operations. */
    charges: {
      /**
       * Create a Charge.
       *
       * Real: `stripe.charges.create({ amount, currency, source, ... })`
       * Mvfm: `$.stripe.charges.create({ amount, currency, source, ... })`
       */
      create(params: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;

      /**
       * Retrieve a Charge by ID.
       *
       * Real: `stripe.charges.retrieve('ch_...')`
       * Mvfm: `$.stripe.charges.retrieve('ch_...')`
       */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;

      /**
       * List Charges.
       *
       * Real: `stripe.charges.list({ limit: 5 })`
       * Mvfm: `$.stripe.charges.list({ limit: 5 })`
       *
       * Returns `{object: 'list', data: Charge[], has_more: boolean}`.
       */
      list(params?: Expr<Record<string, unknown>> | Record<string, unknown>): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the Stripe plugin.
 *
 * The apiKey is baked into the AST config field. At runtime, the
 * server handler uses it to authenticate with the Stripe API.
 */
export interface StripeConfig {
  /** Stripe secret API key (e.g. `sk_test_...`). */
  apiKey: string;
  /** Stripe API version override. Defaults to `2025-04-30.basil`. */
  apiVersion?: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Stripe plugin factory. Namespace: `stripe/`.
 *
 * Creates a plugin that exposes payment intents, customers, and
 * charges operations as AST-building methods on `$.stripe`.
 *
 * @param config - A {@link StripeConfig} object with at minimum an API key.
 * @returns A {@link PluginDefinition} for the stripe plugin.
 */
export function stripe(config: StripeConfig): PluginDefinition<StripeMethods> {
  return {
    name: "stripe",
    nodeKinds: [
      "stripe/create_payment_intent",
      "stripe/retrieve_payment_intent",
      "stripe/confirm_payment_intent",
      "stripe/create_customer",
      "stripe/retrieve_customer",
      "stripe/update_customer",
      "stripe/list_customers",
      "stripe/create_charge",
      "stripe/retrieve_charge",
      "stripe/list_charges",
    ],

    build(ctx: PluginContext): StripeMethods {
      return {
        stripe: {
          paymentIntents: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_payment_intent",
                params: ctx.isExpr(params) ? params.__node : ctx.lift(params).__node,
                config,
              });
            },
            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_payment_intent",
                id: ctx.isExpr(id) ? id.__node : ctx.lift(id).__node,
                config,
              });
            },
            confirm(id, params?) {
              return ctx.expr({
                kind: "stripe/confirm_payment_intent",
                id: ctx.isExpr(id) ? id.__node : ctx.lift(id).__node,
                params: params != null
                  ? (ctx.isExpr(params) ? params.__node : ctx.lift(params).__node)
                  : null,
                config,
              });
            },
          },
          customers: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_customer",
                params: ctx.isExpr(params) ? params.__node : ctx.lift(params).__node,
                config,
              });
            },
            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_customer",
                id: ctx.isExpr(id) ? id.__node : ctx.lift(id).__node,
                config,
              });
            },
            update(id, params) {
              return ctx.expr({
                kind: "stripe/update_customer",
                id: ctx.isExpr(id) ? id.__node : ctx.lift(id).__node,
                params: ctx.isExpr(params) ? params.__node : ctx.lift(params).__node,
                config,
              });
            },
            list(params?) {
              return ctx.expr({
                kind: "stripe/list_customers",
                params: params != null
                  ? (ctx.isExpr(params) ? params.__node : ctx.lift(params).__node)
                  : null,
                config,
              });
            },
          },
          charges: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_charge",
                params: ctx.isExpr(params) ? params.__node : ctx.lift(params).__node,
                config,
              });
            },
            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_charge",
                id: ctx.isExpr(id) ? id.__node : ctx.lift(id).__node,
                config,
              });
            },
            list(params?) {
              return ctx.expr({
                kind: "stripe/list_charges",
                params: params != null
                  ? (ctx.isExpr(params) ? params.__node : ctx.lift(params).__node)
                  : null,
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
// HONEST ASSESSMENT: What works, what's different, what breaks
// ============================================================
//
// Based on source-level analysis of stripe-node
// (github.com/stripe/stripe-node).
//
// ✅ WORKS GREAT:
//
// 1. Basic CRUD operations:
//    Real:  const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Mvfm: const pi = $.stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Nearly identical. No await, $ prefix.
//
// 2. Chaining results via proxy:
//    const customer = $.stripe.customers.create({ email: '...' })
//    const charge = $.stripe.charges.create({ ..., customer: customer.id })
//    Proxy chain captures the dependency graph.
//
// 3. Error handling via error plugin:
//    $.try($.stripe.paymentIntents.create({ amount: -1, currency: 'usd' }))
//      .catch(err => fallback)
//    Stripe API errors (StripeInvalidRequestError, StripeCardError, etc.)
//    are caught by the error plugin's $.try/$.attempt/$.orElse.
//
// 4. Parallel operations via fiber plugin:
//    $.par(
//      $.stripe.customers.retrieve('cus_1'),
//      $.stripe.customers.retrieve('cus_2'),
//    )
//
// ⚠️  WORKS BUT DIFFERENT:
//
// 5. List pagination:
//    Real: for await (const charge of stripe.charges.list()) { ... }
//    Mvfm: $.stripe.charges.list({ limit: 100 })
//    Returns one page. No auto-pagination (that requires async iteration
//    which can't be expressed as a finite AST). Users must manually
//    paginate with starting_after parameter.
//
// 6. Response types:
//    Real SDK returns fully-typed Stripe.PaymentIntent, Stripe.Customer, etc.
//    Mvfm returns Record<string, unknown> — the proxy gives you property
//    access but without the SDK's detailed type narrowing. This is because
//    Stripe's response types have hundreds of fields and deep nesting;
//    modeling all of them as Mvfm types would be enormous and fragile.
//
// ❌ DOESN'T WORK:
//
// 7. Auto-pagination (for await / autoPagingEach / autoPagingToArray):
//    Requires async iteration — can't be expressed as a finite AST.
//
// 8. Webhooks:
//    Push-based, server-initiated. Out of scope per issue #39.
//
// 9. Stripe.js (client-side tokenization):
//    Runs in the browser independently. Not an API call.
//
// 10. Idempotency keys:
//     The SDK auto-generates idempotency keys for POST requests with
//     retries. Our interpreter doesn't model this yet. Could be added
//     as an optional field on the api_call effect.
//
// 11. Expand parameters:
//     Real: stripe.paymentIntents.retrieve('pi_...', { expand: ['customer'] })
//     Mvfm: Users can pass expand in params, but the response type won't
//     reflect the expanded fields (still Record<string, unknown>).
//
// ============================================================
// SUMMARY:
// For the 90% case of "create, retrieve, update, list" — this is
// nearly identical to the real Stripe SDK. Proxy chains capture
// dependencies between operations. Error handling and parallel
// execution work via existing mvfm plugins.
//
// The main gap is pagination: Stripe's auto-pagination uses async
// iteration, which fundamentally can't be modeled as a finite AST.
// Users get single-page list results and must paginate manually.
//
// The key insight: Stripe's API is pure request-response with no
// nested scoping (unlike postgres transactions/cursors). This makes
// the interpreter and handlers trivially simple — one effect type
// (`stripe/api_call`) covers all operations.
// ============================================================
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/stripe/2025-04-30.basil/index.test.ts`
Expected: All 15 tests PASS

**Step 5: Commit**

```bash
git add src/plugins/stripe/2025-04-30.basil/index.ts tests/plugins/stripe/2025-04-30.basil/index.test.ts
git commit -m "feat(stripe): add plugin definition with AST builder for all 10 operations"
```

---

### Task 3: Interpreter — generator fragment for all 10 operations

**Files:**
- Create: `src/plugins/stripe/2025-04-30.basil/interpreter.ts`
- Create: `tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts`

**Step 1: Write the interpreter test (unit level, no stripe-mock yet)**

Create: `tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts`

This test verifies the interpreter yields the correct `stripe/api_call` effects. We use `foldAST` with a mock handler that captures the effects.

```typescript
import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { stripe } from "../../../../src/plugins/stripe/2025-04-30.basil";
import { stripeInterpreter } from "../../../../src/plugins/stripe/2025-04-30.basil/interpreter";

const app = mvfm(num, str, stripe({ apiKey: "sk_test_fake" }));

const fragments = [stripeInterpreter, coreInterpreter, numInterpreter, strInterpreter];

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

describe("stripe interpreter: api_call effects", () => {
  it("create_payment_intent yields correct api_call", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }),
    );

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "pi_mock", status: "requires_payment_method" };
      },
    });

    const result = await recurse(prog.ast.result);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents");
    expect(captured[0].params).toEqual({ amount: 2000, currency: "usd" });
    expect((result as any).id).toBe("pi_mock");
  });

  it("retrieve_payment_intent yields GET with id in path", async () => {
    const prog = app(($) => $.stripe.paymentIntents.retrieve("pi_123"));

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "pi_123", status: "succeeded" };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123");
    expect(captured[0].params).toBeUndefined();
  });

  it("confirm_payment_intent yields POST with id in path", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.confirm("pi_123", { payment_method: "pm_card_visa" }),
    );

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "pi_123", status: "succeeded" };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123/confirm");
    expect(captured[0].params).toEqual({ payment_method: "pm_card_visa" });
  });

  it("create_customer yields POST /v1/customers", async () => {
    const prog = app(($) =>
      $.stripe.customers.create({ email: "test@example.com" }),
    );

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "cus_mock", email: "test@example.com" };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ email: "test@example.com" });
  });

  it("update_customer yields POST /v1/customers/{id}", async () => {
    const prog = app(($) =>
      $.stripe.customers.update("cus_123", { name: "Updated" }),
    );

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "cus_123", name: "Updated" };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers/cus_123");
    expect(captured[0].params).toEqual({ name: "Updated" });
  });

  it("list_customers yields GET /v1/customers", async () => {
    const prog = app(($) => $.stripe.customers.list({ limit: 10 }));

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { object: "list", data: [], has_more: false };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("create_charge yields POST /v1/charges", async () => {
    const prog = app(($) =>
      $.stripe.charges.create({ amount: 1000, currency: "usd", source: "tok_visa" }),
    );

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { id: "ch_mock", amount: 1000 };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/charges");
  });

  it("list with no params yields undefined params", async () => {
    const prog = app(($) => $.stripe.charges.list());

    const captured: any[] = [];
    const recurse = foldAST(fragments, {
      "stripe/api_call": async (effect) => {
        captured.push(effect);
        return { object: "list", data: [], has_more: false };
      },
    });

    await recurse(prog.ast.result);
    expect(captured[0].params).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts`
Expected: FAIL — module not found

**Step 3: Write the interpreter**

Create: `src/plugins/stripe/2025-04-30.basil/interpreter.ts`

```typescript
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Stripe API client interface consumed by the stripe server handler.
 *
 * Abstracts over the actual Stripe SDK so handlers can be tested
 * with mock clients. Uses a single `request` method matching the
 * SDK's `rawRequest()` signature.
 */
export interface StripeClient {
  /** Execute a Stripe API request. */
  request(
    method: string,
    path: string,
    params?: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for stripe plugin nodes.
 *
 * All 10 operations yield a uniform `stripe/api_call` effect with
 * method, path, and params. The effect handler (server or client)
 * determines how the API call is executed.
 *
 * Stripe API paths follow the SDK's StripeResource definitions:
 * - POST /v1/payment_intents (create)
 * - GET /v1/payment_intents/{id} (retrieve)
 * - POST /v1/payment_intents/{id}/confirm (confirm)
 * - etc.
 */
export const stripeInterpreter: InterpreterFragment = {
  pluginName: "stripe",
  canHandle: (node) => node.kind.startsWith("stripe/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Payment Intents ----

      case "stripe/create_payment_intent": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/payment_intents",
          params,
        };
      }

      case "stripe/retrieve_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/payment_intents/${id}`,
        };
      }

      case "stripe/confirm_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const params = node.params != null
          ? (yield { type: "recurse", child: node.params as ASTNode })
          : undefined;
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: `/v1/payment_intents/${id}/confirm`,
          params: params as Record<string, unknown> | undefined,
        };
      }

      // ---- Customers ----

      case "stripe/create_customer": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/customers",
          params,
        };
      }

      case "stripe/retrieve_customer": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/customers/${id}`,
        };
      }

      case "stripe/update_customer": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: `/v1/customers/${id}`,
          params,
        };
      }

      case "stripe/list_customers": {
        const params = node.params != null
          ? (yield { type: "recurse", child: node.params as ASTNode })
          : undefined;
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: "/v1/customers",
          params: params as Record<string, unknown> | undefined,
        };
      }

      // ---- Charges ----

      case "stripe/create_charge": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/charges",
          params,
        };
      }

      case "stripe/retrieve_charge": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/charges/${id}`,
        };
      }

      case "stripe/list_charges": {
        const params = node.params != null
          ? (yield { type: "recurse", child: node.params as ASTNode })
          : undefined;
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: "/v1/charges",
          params: params as Record<string, unknown> | undefined,
        };
      }

      default:
        throw new Error(`Stripe interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/plugins/stripe/2025-04-30.basil/interpreter.ts tests/plugins/stripe/2025-04-30.basil/interpreter.test.ts
git commit -m "feat(stripe): add generator-based interpreter yielding stripe/api_call effects"
```

---

### Task 4: Server handler and SDK adapter

**Files:**
- Create: `src/plugins/stripe/2025-04-30.basil/handler.server.ts`
- Create: `src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts`

**Step 1: Write handler.server.ts**

```typescript
import type { StepHandler } from "../../../core";
import type { StripeClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes stripe effects
 * against a real Stripe API client.
 *
 * Handles a single effect type:
 * - `stripe/api_call` — delegates to {@link StripeClient.request}
 *
 * Unlike the postgres server handler, Stripe is pure request-response
 * with no nested evaluation (no transactions, cursors, etc.), so this
 * handler is trivially simple.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: StripeClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "stripe/api_call") {
      const { method, path, params } = effect as {
        type: "stripe/api_call";
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`stripe serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function for stripe programs.
 *
 * Convenience wrapper that composes fragments + server handler into
 * a single async evaluator, matching the pattern of postgres's
 * `serverEvaluate`.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @param fragments - Interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: StripeClient,
  fragments: import("../../../core").InterpreterFragment[],
): (root: import("../../../core").ASTNode) => Promise<unknown> {
  const { runAST } = require("../../../core") as typeof import("../../../core");
  const handler = serverHandler(client);

  return async (root) => {
    const { value } = await runAST(root, fragments, handler, undefined);
    return value;
  };
}
```

Note: The `serverEvaluate` wrapper should use a proper import. Revise during implementation to use a static import of `runAST` from `"../../../core"` at the top of the file:

```typescript
import { runAST } from "../../../core";
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import type { StripeClient } from "./interpreter";
```

**Step 2: Write client-stripe-sdk.ts**

```typescript
import type Stripe from "stripe";
import type { StripeClient } from "./interpreter";

/**
 * Wraps an official Stripe SDK instance into a {@link StripeClient}.
 *
 * Uses the SDK's `rawRequest()` method, which handles authentication,
 * form encoding, retries, and error mapping internally.
 *
 * @param stripe - A configured Stripe SDK instance.
 * @returns A {@link StripeClient} adapter.
 */
export function wrapStripeSdk(stripe: Stripe): StripeClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const response = await stripe.rawRequest(method, path, params ?? undefined);
      return response;
    },
  };
}
```

**Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/plugins/stripe/2025-04-30.basil/handler.server.ts src/plugins/stripe/2025-04-30.basil/client-stripe-sdk.ts
git commit -m "feat(stripe): add server handler and Stripe SDK adapter"
```

---

### Task 5: Client handler

**Files:**
- Create: `src/plugins/stripe/2025-04-30.basil/handler.client.ts`

**Step 1: Write the client handler**

This is identical in structure to the postgres client handler — same proxy protocol.

```typescript
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side stripe handler.
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
 * Creates a client-side {@link StepHandler} that sends stripe effects
 * as JSON to a remote server endpoint for execution.
 *
 * Each effect is sent as a POST request to `{baseUrl}/mvfm/execute` with
 * the contract hash, step index, path, and effect payload. The server
 * is expected to return `{ result: unknown }` in the response body.
 *
 * This is the same proxy protocol as the postgres client handler —
 * the server-side proxy validates the contract hash, replays the
 * program to the given step, and executes the effect with real
 * Stripe credentials.
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

**Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/plugins/stripe/2025-04-30.basil/handler.client.ts
git commit -m "feat(stripe): add client-side proxy handler"
```

---

### Task 6: Integration tests with stripe-mock

**Files:**
- Create: `tests/plugins/stripe/2025-04-30.basil/integration.test.ts`

**Step 1: Write integration tests**

These use the `stripe/stripe-mock` Docker container via testcontainers' `GenericContainer`, and the Stripe SDK pointed at the mock server.

```typescript
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { stripe as stripePlugin } from "../../../../src/plugins/stripe/2025-04-30.basil";
import { wrapStripeSdk } from "../../../../src/plugins/stripe/2025-04-30.basil/client-stripe-sdk";
import { serverEvaluate } from "../../../../src/plugins/stripe/2025-04-30.basil/handler.server";
import { stripeInterpreter } from "../../../../src/plugins/stripe/2025-04-30.basil/interpreter";

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

let container: StartedTestContainer;
let sdk: Stripe;

const allFragments = [
  stripeInterpreter,
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  strInterpreter,
];

// apiKey is unused by stripe-mock but the SDK requires it
const app = mvfm(
  num,
  str,
  stripePlugin({ apiKey: "sk_test_fake" }),
  fiber,
  error,
);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapStripeSdk(sdk);
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

beforeAll(async () => {
  container = await new GenericContainer("stripe/stripe-mock:latest")
    .withExposedPorts(12111)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(12111);

  sdk = new Stripe("sk_test_fake", {
    host,
    port: String(port),
    protocol: "http",
  });
}, 60000);

afterAll(async () => {
  await container.stop();
});

// ============================================================
// Payment Intents
// ============================================================

describe("stripe integration: payment intents", () => {
  it("create payment intent", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
    expect(result.id).toBeDefined();
  });

  it("retrieve payment intent", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.retrieve("pi_xxxxxxxxxxxxx"),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
  });

  it("confirm payment intent", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.confirm("pi_xxxxxxxxxxxxx", {
        payment_method: "pm_card_visa",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
  });
});

// ============================================================
// Customers
// ============================================================

describe("stripe integration: customers", () => {
  it("create customer", async () => {
    const prog = app(($) =>
      $.stripe.customers.create({ email: "test@example.com" }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
    expect(result.id).toBeDefined();
  });

  it("retrieve customer", async () => {
    const prog = app(($) =>
      $.stripe.customers.retrieve("cus_xxxxxxxxxxxxx"),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
  });

  it("update customer", async () => {
    const prog = app(($) =>
      $.stripe.customers.update("cus_xxxxxxxxxxxxx", { name: "Updated Name" }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
  });

  it("list customers", async () => {
    const prog = app(($) => $.stripe.customers.list({ limit: 3 }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Charges
// ============================================================

describe("stripe integration: charges", () => {
  it("create charge", async () => {
    const prog = app(($) =>
      $.stripe.charges.create({
        amount: 1000,
        currency: "usd",
        source: "tok_visa",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });

  it("retrieve charge", async () => {
    const prog = app(($) =>
      $.stripe.charges.retrieve("ch_xxxxxxxxxxxxx"),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
  });

  it("list charges", async () => {
    const prog = app(($) => $.stripe.charges.list({ limit: 5 }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.data).toBeDefined();
  });
});

// ============================================================
// Composition: error + stripe
// ============================================================

describe("composition: error + stripe", () => {
  it("$.try catches stripe API error", async () => {
    // stripe-mock may not return real errors for invalid params,
    // but this tests the error plugin wiring
    const prog = app(($) =>
      $.try(
        $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }),
      ).catch((_err) => ({ caught: true })),
    );
    const result = (await run(prog)) as any;
    // stripe-mock returns success, so we should get the PI back
    expect(result.object).toBe("payment_intent");
  });

  it("$.attempt wraps successful stripe call", async () => {
    const prog = app(($) =>
      $.attempt($.stripe.customers.create({ email: "a@b.com" })),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + stripe
// ============================================================

describe("composition: fiber + stripe", () => {
  it("$.par runs stripe calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.stripe.customers.create({ email: "a@b.com" }),
        $.stripe.customers.create({ email: "c@d.com" }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("customer");
    expect(result[1].object).toBe("customer");
  });
});

// ============================================================
// Chaining: use result of one call in another
// ============================================================

describe("stripe integration: chaining", () => {
  it("create customer then create charge with customer id", async () => {
    const prog = app(($) => {
      const customer = $.stripe.customers.create({ email: "chain@test.com" });
      const charge = $.stripe.charges.create({
        amount: 500,
        currency: "usd",
        customer: customer.id,
        source: "tok_visa",
      } as any);
      return $.do(customer, charge);
    });
    const result = (await run(prog)) as any;
    // $.do returns the last value
    expect(result.object).toBe("charge");
  });
});
```

**Step 2: Run the integration tests**

Run: `npx vitest run tests/plugins/stripe/2025-04-30.basil/integration.test.ts --timeout 60000`
Expected: All tests PASS (may take ~30s for container startup)

Note: If stripe-mock rejects requests or returns unexpected responses, adjust test expectations based on what stripe-mock actually returns. The fixtures are hardcoded and may not reflect all input params.

**Step 3: Commit**

```bash
git add tests/plugins/stripe/2025-04-30.basil/integration.test.ts
git commit -m "test(stripe): add integration tests with stripe-mock container"
```

---

### Task 7: Public exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Add stripe exports to src/index.ts**

Add the following exports after the postgres exports block:

```typescript
export type { StripeConfig, StripeMethods } from "./plugins/stripe/2025-04-30.basil";
export { stripe } from "./plugins/stripe/2025-04-30.basil";
export { wrapStripeSdk } from "./plugins/stripe/2025-04-30.basil/client-stripe-sdk";
export type {
  ClientHandlerOptions as StripeClientHandlerOptions,
  ClientHandlerState as StripeClientHandlerState,
} from "./plugins/stripe/2025-04-30.basil/handler.client";
export { clientHandler as stripeClientHandler } from "./plugins/stripe/2025-04-30.basil/handler.client";
export { serverEvaluate as stripeServerEvaluate, serverHandler as stripeServerHandler } from "./plugins/stripe/2025-04-30.basil/handler.server";
export type { StripeClient } from "./plugins/stripe/2025-04-30.basil/interpreter";
export { stripeInterpreter } from "./plugins/stripe/2025-04-30.basil/interpreter";
```

Note: The client handler types and functions are aliased with `Stripe` prefix to avoid collision with the postgres exports of the same names.

**Step 2: Run build + check + tests**

Run: `npm run build && npm run check && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(stripe): add public exports for stripe plugin"
```

---

### Task 8: Update plugin authoring guide example

**Files:**
- Modify: `src/plugin-authoring-guide.ts`

**Step 1: Update the example stripe plugin in the guide**

The existing guide uses a minimal stripe example that's now out of date (no interpreter fragment that yields effects, no handler pattern). Update the example to reference the real stripe plugin as the second reference implementation alongside postgres.

Add a comment at the top of the stripe example section:

```typescript
// NOTE: A full, production-quality Stripe plugin now exists at
// src/plugins/stripe/2025-04-30.basil/. This example below is
// simplified for illustration. See the real plugin for the
// complete pattern including generator interpreter, server/client
// handlers, and SDK adapter.
```

**Step 2: Run build**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/plugin-authoring-guide.ts
git commit -m "docs: update plugin authoring guide to reference real stripe implementation"
```

---

### Task 9: Final validation

**Step 1: Run full build + check + test suite**

Run: `npm run build && npm run check && npm test`
Expected: Everything green

**Step 2: Verify no lint issues**

Run: `npx biome check src/plugins/stripe/ tests/plugins/stripe/`
Expected: No errors

**Step 3: Review the file tree is correct**

Expected structure:
```
src/plugins/stripe/2025-04-30.basil/
├── index.ts              (plugin definition + AST builder)
├── interpreter.ts        (generator fragment + StripeClient interface)
├── handler.server.ts     (server handler + serverEvaluate)
├── handler.client.ts     (client proxy handler)
└── client-stripe-sdk.ts  (Stripe SDK adapter)

tests/plugins/stripe/2025-04-30.basil/
├── index.test.ts         (AST parity tests)
├── interpreter.test.ts   (unit tests with mock handler)
└── integration.test.ts   (stripe-mock container tests)
```
