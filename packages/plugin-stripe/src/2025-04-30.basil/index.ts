// ============================================================
// MVFM PLUGIN: stripe (stripe-node compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - PaymentIntents: create, retrieve, confirm
//   - Customers: create, retrieve, update, list
//   - Charges: create, retrieve, list
// ============================================================

import type Stripe from "stripe";
import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
import { wrapStripeSdk } from "./client-stripe-sdk";
import { createStripeInterpreter, type StripeClient } from "./interpreter";

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

// ---- Default interpreter wiring ---------------------------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function createDefaultInterpreter(config: StripeConfig): Interpreter {
  let clientPromise: Promise<StripeClient> | undefined;
  const getClient = async (): Promise<StripeClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("stripe").then((moduleValue) => {
        const StripeCtor = moduleValue.default as new (
          apiKey: string,
          opts?: Record<string, unknown>,
        ) => Parameters<typeof wrapStripeSdk>[0];
        const opts: Record<string, unknown> = {};
        if (config.apiVersion) opts.apiVersion = config.apiVersion;
        return wrapStripeSdk(new StripeCtor(config.apiKey, opts));
      });
    }
    return clientPromise;
  };

  const lazyClient: StripeClient = {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, params);
    },
  };

  return createStripeInterpreter(lazyClient);
}

// ---- Constructor builder ----------------------------------

/**
 * Builds the stripe constructor methods using makeCExpr.
 *
 * Constructors use Liftable<T> for object params and string | CExpr<string>
 * for ID params. Validation happens at `app()` time via KindSpec.
 */
function buildStripeApi() {
  return {
    paymentIntents: {
      /** Create a PaymentIntent. */
      create(
        params: Liftable<Stripe.PaymentIntentCreateParams>,
      ): CExpr<
        Stripe.PaymentIntent,
        "stripe/create_payment_intent",
        [Liftable<Stripe.PaymentIntentCreateParams>]
      > {
        return makeCExpr("stripe/create_payment_intent", [params]) as any;
      },
      /** Retrieve a PaymentIntent by ID. */
      retrieve(
        id: string | CExpr<string>,
      ): CExpr<Stripe.PaymentIntent, "stripe/retrieve_payment_intent", [string | CExpr<string>]> {
        return makeCExpr("stripe/retrieve_payment_intent", [id]) as any;
      },
      /** Confirm a PaymentIntent, optionally with additional params. */
      confirm(
        id: string | CExpr<string>,
        ...params: [] | [Liftable<Stripe.PaymentIntentConfirmParams>]
      ): CExpr<
        Stripe.PaymentIntent,
        "stripe/confirm_payment_intent",
        | [string | CExpr<string>]
        | [string | CExpr<string>, Liftable<Stripe.PaymentIntentConfirmParams>]
      > {
        return makeCExpr("stripe/confirm_payment_intent", [id, ...params] as unknown[]) as any;
      },
    },
    customers: {
      /** Create a Customer. */
      create(
        params: Liftable<Stripe.CustomerCreateParams>,
      ): CExpr<
        Stripe.Customer,
        "stripe/create_customer",
        [Liftable<Stripe.CustomerCreateParams>]
      > {
        return makeCExpr("stripe/create_customer", [params]) as any;
      },
      /** Retrieve a Customer by ID. */
      retrieve(
        id: string | CExpr<string>,
      ): CExpr<Stripe.Customer, "stripe/retrieve_customer", [string | CExpr<string>]> {
        return makeCExpr("stripe/retrieve_customer", [id]) as any;
      },
      /** Update a Customer by ID. */
      update(
        id: string | CExpr<string>,
        params: Liftable<Stripe.CustomerUpdateParams>,
      ): CExpr<
        Stripe.Customer,
        "stripe/update_customer",
        [string | CExpr<string>, Liftable<Stripe.CustomerUpdateParams>]
      > {
        return makeCExpr("stripe/update_customer", [id, params]) as any;
      },
      /** List Customers with optional filter params. */
      list(
        ...params: [] | [Liftable<Stripe.CustomerListParams>]
      ): CExpr<
        Stripe.ApiList<Stripe.Customer>,
        "stripe/list_customers",
        [] | [Liftable<Stripe.CustomerListParams>]
      > {
        return makeCExpr("stripe/list_customers", params as unknown[]) as any;
      },
    },
    charges: {
      /** Create a Charge. */
      create(
        params: Liftable<Stripe.ChargeCreateParams>,
      ): CExpr<
        Stripe.Charge,
        "stripe/create_charge",
        [Liftable<Stripe.ChargeCreateParams>]
      > {
        return makeCExpr("stripe/create_charge", [params]) as any;
      },
      /** Retrieve a Charge by ID. */
      retrieve(
        id: string | CExpr<string>,
      ): CExpr<Stripe.Charge, "stripe/retrieve_charge", [string | CExpr<string>]> {
        return makeCExpr("stripe/retrieve_charge", [id]) as any;
      },
      /** List Charges with optional filter params. */
      list(
        ...params: [] | [Liftable<Stripe.ChargeListParams>]
      ): CExpr<
        Stripe.ApiList<Stripe.Charge>,
        "stripe/list_charges",
        [] | [Liftable<Stripe.ChargeListParams>]
      > {
        return makeCExpr("stripe/list_charges", params as unknown[]) as any;
      },
    },
  };
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the stripe plugin definition (unified Plugin type).
 *
 * @param config - A {@link StripeConfig} with apiKey and optional apiVersion.
 * @returns A unified Plugin that contributes `$.stripe`.
 */
export function stripe(config: StripeConfig) {
  return {
    name: "stripe" as const,
    ctors: { stripe: buildStripeApi() },
    kinds: {
      "stripe/create_payment_intent": {
        inputs: [undefined as unknown as Stripe.PaymentIntentCreateParams],
        output: undefined as unknown as Stripe.PaymentIntent,
      } as KindSpec<[Stripe.PaymentIntentCreateParams], Stripe.PaymentIntent>,
      "stripe/retrieve_payment_intent": {
        inputs: [""] as [string],
        output: undefined as unknown as Stripe.PaymentIntent,
      } as KindSpec<[string], Stripe.PaymentIntent>,
      "stripe/confirm_payment_intent": {
        inputs: [""] as [string],
        output: undefined as unknown as Stripe.PaymentIntent,
      } as KindSpec<[string], Stripe.PaymentIntent>,
      "stripe/create_customer": {
        inputs: [undefined as unknown as Stripe.CustomerCreateParams],
        output: undefined as unknown as Stripe.Customer,
      } as KindSpec<[Stripe.CustomerCreateParams], Stripe.Customer>,
      "stripe/retrieve_customer": {
        inputs: [""] as [string],
        output: undefined as unknown as Stripe.Customer,
      } as KindSpec<[string], Stripe.Customer>,
      "stripe/update_customer": {
        inputs: ["", undefined as unknown as Stripe.CustomerUpdateParams] as [
          string,
          Stripe.CustomerUpdateParams,
        ],
        output: undefined as unknown as Stripe.Customer,
      } as KindSpec<[string, Stripe.CustomerUpdateParams], Stripe.Customer>,
      "stripe/list_customers": {
        inputs: [] as Stripe.CustomerListParams[],
        output: undefined as unknown as Stripe.ApiList<Stripe.Customer>,
      } as KindSpec<Stripe.CustomerListParams[], Stripe.ApiList<Stripe.Customer>>,
      "stripe/create_charge": {
        inputs: [undefined as unknown as Stripe.ChargeCreateParams],
        output: undefined as unknown as Stripe.Charge,
      } as KindSpec<[Stripe.ChargeCreateParams], Stripe.Charge>,
      "stripe/retrieve_charge": {
        inputs: [""] as [string],
        output: undefined as unknown as Stripe.Charge,
      } as KindSpec<[string], Stripe.Charge>,
      "stripe/list_charges": {
        inputs: [] as Stripe.ChargeListParams[],
        output: undefined as unknown as Stripe.ApiList<Stripe.Charge>,
      } as KindSpec<Stripe.ChargeListParams[], Stripe.ApiList<Stripe.Charge>>,
    },
    shapes: {
      "stripe/create_payment_intent": "*",
      "stripe/confirm_payment_intent": [null, "*"],
      "stripe/create_customer": "*",
      "stripe/update_customer": [null, "*"],
      "stripe/list_customers": "*",
      "stripe/create_charge": "*",
      "stripe/list_charges": "*",
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  } satisfies Plugin;
}

/**
 * Alias for {@link stripe}, kept for readability at call sites.
 */
export const stripePlugin = stripe;
