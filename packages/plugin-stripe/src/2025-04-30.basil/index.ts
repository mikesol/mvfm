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

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapStripeSdk } from "./client-stripe-sdk";
import { createStripeInterpreter, type StripeClient } from "./interpreter";

// ---- liftArg: recursive plain-value → CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `stripe/record` CExprs with key-value child pairs.
 * - Arrays become `stripe/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("stripe/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("stripe/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/**
 * Stripe operations added to the DSL context by the stripe plugin.
 *
 * Mirrors the stripe-node SDK resource API: payment intents,
 * customers, and charges. Each resource exposes CRUD-style methods
 * that produce CExpr nodes.
 */
export interface StripeMethods {
  /** Stripe API operations, namespaced under `$.stripe`. */
  stripe: {
    paymentIntents: {
      /** Create a PaymentIntent. */
      create(
        params: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
      /** Retrieve a PaymentIntent by ID. */
      retrieve(id: string | CExpr<string>): CExpr<Record<string, unknown>>;
      /** Confirm a PaymentIntent, optionally with additional params. */
      confirm(
        id: string | CExpr<string>,
        params?: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
    };
    customers: {
      /** Create a Customer. */
      create(
        params: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
      /** Retrieve a Customer by ID. */
      retrieve(id: string | CExpr<string>): CExpr<Record<string, unknown>>;
      /** Update a Customer by ID. */
      update(
        id: string | CExpr<string>,
        params: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
      /** List Customers with optional filter params. */
      list(
        params?: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
    };
    charges: {
      /** Create a Charge. */
      create(
        params: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
      /** Retrieve a Charge by ID. */
      retrieve(id: string | CExpr<string>): CExpr<Record<string, unknown>>;
      /** List Charges with optional filter params. */
      list(
        params?: Record<string, unknown> | CExpr<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>>;
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

// ---- Node kinds -------------------------------------------

const NODE_KINDS = [
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
  "stripe/record",
  "stripe/array",
] as const;

function buildKinds(): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const kind of NODE_KINDS) {
    kinds[kind] = {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>;
  }
  return kinds;
}

// ---- Constructor builder ----------------------------------

function buildStripeApi(): StripeMethods["stripe"] {
  return {
    paymentIntents: {
      create(params) {
        return makeCExpr("stripe/create_payment_intent", [liftArg(params)]);
      },
      retrieve(id) {
        return makeCExpr("stripe/retrieve_payment_intent", [id]);
      },
      confirm(id, params?) {
        if (params == null) {
          return makeCExpr("stripe/confirm_payment_intent", [id]);
        }
        return makeCExpr("stripe/confirm_payment_intent", [id, liftArg(params)]);
      },
    },
    customers: {
      create(params) {
        return makeCExpr("stripe/create_customer", [liftArg(params)]);
      },
      retrieve(id) {
        return makeCExpr("stripe/retrieve_customer", [id]);
      },
      update(id, params) {
        return makeCExpr("stripe/update_customer", [id, liftArg(params)]);
      },
      list(params?) {
        if (params == null) {
          return makeCExpr("stripe/list_customers", []);
        }
        return makeCExpr("stripe/list_customers", [liftArg(params)]);
      },
    },
    charges: {
      create(params) {
        return makeCExpr("stripe/create_charge", [liftArg(params)]);
      },
      retrieve(id) {
        return makeCExpr("stripe/retrieve_charge", [id]);
      },
      list(params?) {
        if (params == null) {
          return makeCExpr("stripe/list_charges", []);
        }
        return makeCExpr("stripe/list_charges", [liftArg(params)]);
      },
    },
  };
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
        const Stripe = moduleValue.default as new (
          apiKey: string,
          opts?: Record<string, unknown>,
        ) => Parameters<typeof wrapStripeSdk>[0];
        const opts: Record<string, unknown> = {};
        if (config.apiVersion) opts.apiVersion = config.apiVersion;
        return wrapStripeSdk(new Stripe(config.apiKey, opts));
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
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds: [...NODE_KINDS],
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  };
}

/**
 * Alias for {@link stripe}, kept for readability at call sites.
 */
export const stripePlugin = stripe;
