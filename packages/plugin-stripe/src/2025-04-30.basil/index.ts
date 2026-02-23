// ============================================================
// MVFM PLUGIN: stripe (stripe-node compatible API) — unified Plugin
// ============================================================
//
// Registry-driven plugin factory. Resource definitions in ./resources
// drive constructor, kind, and handler generation via ./registry.
// ============================================================

import type { Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { wrapStripeSdk } from "./client-stripe-sdk";
import { createStripeInterpreter, type StripeClient } from "./interpreter";
import { makeCtors, makeKindSpecs, type ResourceDef, structuralKinds } from "./registry";
import { allResources, flatResourceDefs } from "./resources";

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

// ---- Tree traversal for constructor generation --------------

function isResourceDef(obj: unknown): obj is ResourceDef {
  if (!obj || typeof obj !== "object") return false;
  const values = Object.values(obj);
  return values.length > 0 && values.every((v) => v && typeof v === "object" && "kind" in v);
}

function buildCtorsFromTree(tree: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tree)) {
    if (isResourceDef(value)) {
      result[key] = makeCtors(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = buildCtorsFromTree(value as Record<string, unknown>);
    }
  }
  return result;
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
  const allKinds: Record<string, KindSpec<unknown[], unknown>> = { ...structuralKinds };
  for (const def of flatResourceDefs()) {
    Object.assign(allKinds, makeKindSpecs(def));
  }

  return {
    name: "stripe" as const,
    ctors: { stripe: buildCtorsFromTree(allResources) },
    kinds: allKinds,
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  } satisfies Plugin;
}

/**
 * Alias for {@link stripe}, kept for readability at call sites.
 */
export const stripePlugin = stripe;
