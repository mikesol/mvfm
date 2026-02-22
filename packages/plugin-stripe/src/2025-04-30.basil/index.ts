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

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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

// ---- Constructor builder ----------------------------------

/**
 * Builds the stripe constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildStripeApi() {
  return {
    paymentIntents: {
      /** Create a PaymentIntent. */
      create<A>(params: A): CExpr<Record<string, unknown>, "stripe/create_payment_intent", [A]> {
        return mk("stripe/create_payment_intent", [liftArg(params)]);
      },
      /** Retrieve a PaymentIntent by ID. */
      retrieve<A>(id: A): CExpr<Record<string, unknown>, "stripe/retrieve_payment_intent", [A]> {
        return mk("stripe/retrieve_payment_intent", [id]);
      },
      /** Confirm a PaymentIntent, optionally with additional params. */
      confirm<A, B extends readonly unknown[]>(
        id: A,
        ...params: B
      ): CExpr<Record<string, unknown>, "stripe/confirm_payment_intent", [A, ...B]> {
        const lifted = params.map((p) => liftArg(p));
        return mk("stripe/confirm_payment_intent", [id, ...lifted]);
      },
    },
    customers: {
      /** Create a Customer. */
      create<A>(params: A): CExpr<Record<string, unknown>, "stripe/create_customer", [A]> {
        return mk("stripe/create_customer", [liftArg(params)]);
      },
      /** Retrieve a Customer by ID. */
      retrieve<A>(id: A): CExpr<Record<string, unknown>, "stripe/retrieve_customer", [A]> {
        return mk("stripe/retrieve_customer", [id]);
      },
      /** Update a Customer by ID. */
      update<A, B>(
        id: A,
        params: B,
      ): CExpr<Record<string, unknown>, "stripe/update_customer", [A, B]> {
        return mk("stripe/update_customer", [id, liftArg(params)]);
      },
      /** List Customers with optional filter params. */
      list<A extends readonly unknown[]>(
        ...params: A
      ): CExpr<Record<string, unknown>, "stripe/list_customers", A> {
        return mk("stripe/list_customers", params.map((p) => liftArg(p)));
      },
    },
    charges: {
      /** Create a Charge. */
      create<A>(params: A): CExpr<Record<string, unknown>, "stripe/create_charge", [A]> {
        return mk("stripe/create_charge", [liftArg(params)]);
      },
      /** Retrieve a Charge by ID. */
      retrieve<A>(id: A): CExpr<Record<string, unknown>, "stripe/retrieve_charge", [A]> {
        return mk("stripe/retrieve_charge", [id]);
      },
      /** List Charges with optional filter params. */
      list<A extends readonly unknown[]>(
        ...params: A
      ): CExpr<Record<string, unknown>, "stripe/list_charges", A> {
        return mk("stripe/list_charges", params.map((p) => liftArg(p)));
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
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/retrieve_payment_intent": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/confirm_payment_intent": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/create_customer": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/retrieve_customer": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/update_customer": {
        inputs: [undefined, undefined] as [unknown, unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown, unknown], unknown>,
      "stripe/list_customers": {
        inputs: [] as unknown[],
        output: undefined as unknown,
      } as KindSpec<unknown[], unknown>,
      "stripe/create_charge": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/retrieve_charge": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      "stripe/list_charges": {
        inputs: [] as unknown[],
        output: undefined as unknown,
      } as KindSpec<unknown[], unknown>,
      "stripe/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "stripe/array": {
        inputs: [] as unknown[],
        output: [] as unknown[],
      } as KindSpec<unknown[], unknown[]>,
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
