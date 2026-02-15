// ============================================================
// MVFM PLUGIN: stripe (stripe-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (3 of 57 top-level resources)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (3 of 57 resources)
//
// Implemented:
//   - PaymentIntents: create, retrieve, confirm
//   - Customers: create, retrieve, update, list
//   - Charges: create, retrieve, list
//
// Not doable (fundamental mismatch with AST model):
//   (none — every Stripe resource is request/response, all are
//   modelable. Even pagination can be done via $.rec + has_more.)
//
// Remaining (same CRUD pattern, add as needed):
//   Accounts, AccountLinks, AccountSessions, ApplicationFees,
//   Balance, BalanceTransactions, Coupons, CreditNotes,
//   Disputes, Events, Files, FileLinks, Invoices, InvoiceItems,
//   Mandates, PaymentLinks, PaymentMethods, Payouts, Plans,
//   Prices, Products, PromotionCodes, Quotes, Refunds,
//   SetupIntents, ShippingRates, Sources, Subscriptions,
//   SubscriptionItems, SubscriptionSchedules, Tokens, Topups,
//   Transfers, WebhookEndpoints, and sub-resources under
//   Billing, Checkout, Climate, Identity, Issuing, Radar,
//   Reporting, Sigma, Tax, Terminal, Treasury.
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to StripeMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — stripe/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows stripe-node should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real stripe-node SDK as closely as possible.
//
// Real stripe-node API (v2025-04-30.basil):
//   const stripe = new Stripe('sk_test_...')
//   const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//   const pi = await stripe.paymentIntents.retrieve('pi_123')
//   const pi = await stripe.paymentIntents.confirm('pi_123', { payment_method: 'pm_abc' })
//   const customer = await stripe.customers.create({ email: 'test@example.com' })
//   const customer = await stripe.customers.retrieve('cus_123')
//   const customer = await stripe.customers.update('cus_123', { name: 'New Name' })
//   const customers = await stripe.customers.list({ limit: 10 })
//   const charge = await stripe.charges.create({ amount: 5000, currency: 'usd' })
//   const charge = await stripe.charges.retrieve('ch_123')
//   const charges = await stripe.charges.list({ limit: 25 })
//
// Based on source-level analysis of stripe-node
// (github.com/stripe/stripe-node). The SDK uses
// StripeResource.extend() with stripeMethod() specs defining
// HTTP method + fullPath for each operation.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Stripe operations added to the DSL context by the stripe plugin.
 *
 * Mirrors the stripe-node SDK resource API: payment intents,
 * customers, and charges. Each resource exposes CRUD-style methods
 * that produce namespaced AST nodes.
 */
export interface StripeMethods {
  /** Stripe API operations, namespaced under `$.stripe`. */
  stripe: {
    paymentIntents: {
      /** Create a PaymentIntent. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Retrieve a PaymentIntent by ID. */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** Confirm a PaymentIntent, optionally with additional params. */
      confirm(
        id: Expr<string> | string,
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    customers: {
      /** Create a Customer. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Retrieve a Customer by ID. */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** Update a Customer by ID. */
      update(
        id: Expr<string> | string,
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** List Customers with optional filter params. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    charges: {
      /** Create a Charge. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Retrieve a Charge by ID. */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** List Charges with optional filter params. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the stripe plugin.
 *
 * Requires an API key (secret key). Optionally accepts an
 * apiVersion string to pin a specific Stripe API version.
 */
export interface StripeConfig {
  /** Stripe secret API key (e.g. `sk_test_...` or `sk_live_...`). */
  apiKey: string;
  /** Stripe API version override. Defaults to `2025-04-30.basil`. */
  apiVersion?: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Stripe plugin factory. Namespace: `stripe/`.
 *
 * Creates a plugin that exposes payment intents, customers, and charges
 * resource methods for building parameterized Stripe API call AST nodes.
 *
 * @param config - A {@link StripeConfig} with apiKey and optional apiVersion.
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
      // Helper: resolve an id argument to an AST node.
      // If it's already an Expr, use its __node; otherwise lift the raw value.
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      // Helper: resolve a params object to an AST node.
      // ctx.lift handles both Expr and raw objects (lifts to core/record).
      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      return {
        stripe: {
          paymentIntents: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_payment_intent",
                params: resolveParams(params),
                config,
              });
            },

            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_payment_intent",
                id: resolveId(id),
                config,
              });
            },

            confirm(id, params?) {
              return ctx.expr({
                kind: "stripe/confirm_payment_intent",
                id: resolveId(id),
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
          },

          customers: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_customer",
                params: resolveParams(params),
                config,
              });
            },

            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_customer",
                id: resolveId(id),
                config,
              });
            },

            update(id, params) {
              return ctx.expr({
                kind: "stripe/update_customer",
                id: resolveId(id),
                params: resolveParams(params),
                config,
              });
            },

            list(params?) {
              return ctx.expr({
                kind: "stripe/list_customers",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
          },

          charges: {
            create(params) {
              return ctx.expr({
                kind: "stripe/create_charge",
                params: resolveParams(params),
                config,
              });
            },

            retrieve(id) {
              return ctx.expr({
                kind: "stripe/retrieve_charge",
                id: resolveId(id),
                config,
              });
            },

            list(params?) {
              return ctx.expr({
                kind: "stripe/list_charges",
                params: params != null ? resolveParams(params) : null,
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
// 1. Basic CRUD operations:
//    Real:  const pi = await stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Mvfm:   const pi = $.stripe.paymentIntents.create({ amount: 2000, currency: 'usd' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const customer = $.stripe.customers.create({ email: $.input.email })
//    const pi = $.stripe.paymentIntents.create({ customer: customer.id, amount: $.input.amount })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  stripe.paymentIntents.create(...)
//    Mvfm:   $.stripe.paymentIntents.create(...)
//    The nested resource pattern maps 1:1. An LLM that knows
//    stripe-node can write Mvfm Stripe programs immediately.
//
// 4. Optional params:
//    Real:  await stripe.paymentIntents.confirm('pi_123')
//    Mvfm:   $.stripe.paymentIntents.confirm('pi_123')
//    Both work. The AST stores null for omitted optional params.
//
// WORKS BUT DIFFERENT:
//
// 5. Return types:
//    Real stripe-node has 100+ field response types (PaymentIntent,
//    Customer, Charge, etc.) with precise type definitions.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (customer.id, pi.status),
//    but there's no IDE autocomplete for Stripe-specific fields.
//    A future enhancement could add typed response interfaces.
//
// 6. Sequencing side effects:
//    Real:  await stripe.customers.create(...)
//           await stripe.paymentIntents.create(...)
//    Mvfm:   const c = $.stripe.customers.create(...)
//           const pi = $.stripe.paymentIntents.create({ customer: c.id })
//           return $.do(c, pi)
//    Must use $.do() for sequencing when there are data dependencies.
//    Without data dependency, $.do() is required to avoid orphan errors.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Pagination (auto-pagination):
//    Real:  for await (const customer of stripe.customers.list()) { ... }
//    Mvfm:   Can't model async iterators. $.stripe.customers.list()
//           returns the first page. For full pagination, you'd need
//           $.rec() with has_more / starting_after logic.
//
// 8. Webhooks:
//    Real:  stripe.webhooks.constructEvent(body, sig, secret)
//    Mvfm:   Not modeled. Webhooks are server-initiated push events,
//           not request/response operations. They belong in the
//           interpreter/runtime layer, not in the AST.
//
// 9. Idempotency keys, request options:
//    Real:  stripe.paymentIntents.create({...}, { idempotencyKey: '...' })
//    Mvfm:   Not modeled yet. stripe-node accepts a second RequestOptions
//           argument on every method. This could be added as an optional
//           second/third parameter that becomes an AST field.
//
// 10. Error handling:
//    Real:  try { await stripe.charges.create(...) } catch (e) { if (e.type === 'card_error') ... }
//    Mvfm:   $.try($.stripe.charges.create(...)).catch(err => fallback)
//    Works via the error plugin. Stripe-specific error types
//    (CardError, InvalidRequestError, etc.) would need interpreter
//    support to map correctly.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of stripe-node
// (github.com/stripe/stripe-node, API version 2025-04-30.basil).
//
// For the core 80% use case of "create/retrieve/update/list
// resources" — this is nearly identical to real stripe-node.
// Resource nesting (paymentIntents, customers, charges) maps 1:1.
// Proxy chains capture cross-operation dependencies perfectly.
//
// The main gap is typed response objects — we use
// Record<string, unknown> instead of Stripe.PaymentIntent etc.
// This means no autocomplete on response fields, but property
// access still works at runtime via proxy.
//
// Not supported: auto-pagination, webhooks, file uploads,
// streaming, request-level options (idempotency keys, API
// version overrides). These are either runtime concerns
// (webhooks, streaming) or could be added incrementally
// (idempotency keys as AST fields, pagination via $.rec).
// ============================================================
