/**
 * Generates documentation examples for all Stripe plugin node kinds.
 *
 * Walks the stripe plugin constructor tree at import time to discover
 * kind -> accessor path mappings, then generates a NodeExample for each.
 */

import { stripe } from "@mvfm/plugin-stripe";
import type { ExampleEntry, NamespaceIndex, NodeExample } from "./types";

const STRIPE_PLUGINS = ["@mvfm/plugin-stripe"];

const plugin = stripe({ apiKey: "sk_test_docs" });
const ctorsTree = plugin.ctors.stripe as Record<string, unknown>;

// ---- Kind discovery ----

interface KindInfo {
  accessor: string;
  methodName: string;
  argPattern:
    | "params"
    | "id"
    | "id,params"
    | "id,params?"
    | "params?"
    | "del"
    | ""
    | "singleton,params"
    | "nested"
    | "unknown";
}

/** Try to call a ctor function with dummy args and extract the kind from the result. */
function tryDiscoverKind(fn: Function, attempts: unknown[][]): string | null {
  for (const args of attempts) {
    try {
      const result = fn(...args);
      if (result && typeof result === "object" && "__kind" in result) {
        return (result as { __kind: string }).__kind;
      }
    } catch {
      // ignore, try next
    }
  }
  return null;
}

/** Discover the kind for a ctor function by trying various arg patterns. */
function discoverKind(fn: Function): string | null {
  return tryDiscoverKind(fn, [
    [],
    [{ _dummy: true }],
    ["id_dummy"],
    ["id_dummy", { _dummy: true }],
    ["id_dummy", "child_dummy"],
    ["id_dummy", "child_dummy", { _dummy: true }],
  ]);
}

/** Detect arg pattern from a kind name. */
function detectArgPattern(kind: string): KindInfo["argPattern"] {
  const bare = kind.replace("stripe/", "");
  if (bare.startsWith("list_")) return "params?";
  if (bare.startsWith("retrieve_") || bare.startsWith("find_")) {
    // Could be singleton or ID-based
    return "id";
  }
  if (bare.startsWith("create_")) return "params";
  if (bare.startsWith("update_")) return "id,params";
  if (bare.startsWith("del_") || bare.startsWith("delete_")) return "del";
  if (bare.startsWith("search_")) return "params";
  // Everything else is an action — typically id,params?
  return "id,params?";
}

/** Walk the ctors tree and discover all kind -> accessor mappings. */
function discoverAllKinds(): Map<string, KindInfo> {
  const result = new Map<string, KindInfo>();

  function walk(obj: Record<string, unknown>, path: string[]) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "function") {
        const kind = discoverKind(value as Function);
        if (kind?.startsWith("stripe/")) {
          result.set(kind, {
            accessor: [...path, key].join("."),
            methodName: key,
            argPattern: detectArgPattern(kind),
          });
        }
      } else if (typeof value === "object" && value !== null) {
        walk(value as Record<string, unknown>, [...path, key]);
      }
    }
  }

  walk(ctorsTree, []);
  return result;
}

// ---- Code generation per arg pattern ----

function humanize(kind: string): string {
  const bare = kind.replace("stripe/", "");
  return bare.split("_").join(" ");
}

function makeCodeString(accessor: string, kind: string, info: KindInfo): string {
  const call = makeCtorCall(accessor, kind, info);
  return [
    "const app = mvfm(prelude, console_, stripe_);",
    "const prog = app({}, ($) => {",
    `  const result = $.stripe.${call};`,
    "  return $.console.log(result);",
    "});",
    "await fold(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);",
  ].join("\n");
}

function makeCtorCall(accessor: string, kind: string, info: KindInfo): string {
  const bare = kind.replace("stripe/", "");
  const p = info.argPattern;

  // Singleton patterns
  if (p === "") return `${accessor}()`;
  if (p === "singleton,params") return `${accessor}({ metadata: { key: "value" } })`;

  // List patterns
  if (p === "params?" && bare.startsWith("list_")) return `${accessor}({ limit: 3 })`;

  // Search patterns
  if (bare.startsWith("search_")) return `${accessor}({ query: "status:\\"active\\"", limit: 3 })`;

  // Create patterns
  if (p === "params" && bare.startsWith("create_")) return `${accessor}({})`;
  if (p === "params" && bare.startsWith("preview_")) return `${accessor}({})`;
  if (p === "params") return `${accessor}({})`;

  // ID-only patterns
  if (p === "id") return `${accessor}("id_abc123")`;
  if (p === "del") return `${accessor}("id_abc123")`;

  // ID + params patterns
  if (p === "id,params") return `${accessor}("id_abc123", { metadata: { key: "value" } })`;
  if (p === "id,params?") return `${accessor}("id_abc123")`;

  // Nested patterns (detected from kind having parent resource)
  return `${accessor}("id_abc123")`;
}

// ---- Existing hand-crafted kinds (from stripe.ts) ----

const HAND_CRAFTED = new Set([
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
]);

// ---- Namespace index ----

function buildNamespaceIndex(): NamespaceIndex {
  return {
    content: [
      "<p>The <strong>Stripe plugin</strong> provides type-safe access to the ",
      '<a href="https://stripe.com/docs/api">Stripe API</a>. ',
      "Every API resource and method is available as a node kind, with support for ",
      "all CRUD operations, list/search, and resource-specific actions.</p>",
      "<p>Methods are accessed via the <code>$.stripe</code> namespace using ",
      "the same resource structure as the Stripe SDK (e.g. ",
      "<code>$.stripe.paymentIntents.create()</code>).</p>",
      `<p>The plugin ships with ${plugin.kinds ? Object.keys(plugin.kinds).length : 469} `,
      "node kinds covering the full Stripe API surface area.</p>",
    ].join(""),
  };
}

// ---- Main generator ----

/** Generate all Stripe documentation examples. */
export function generateStripeExamples(): Record<string, ExampleEntry> {
  const examples: Record<string, ExampleEntry> = {};
  const kindMap = discoverAllKinds();

  // Namespace landing page
  examples.stripe = buildNamespaceIndex();

  for (const [kind, info] of kindMap) {
    // Skip hand-crafted examples — they are defined in stripe.ts
    if (HAND_CRAFTED.has(kind)) continue;

    const desc = humanize(kind).replace(/^(\w)/, (_, c) => c.toUpperCase());
    const code = makeCodeString(info.accessor, kind, info);

    const example: NodeExample = {
      description: desc,
      code,
      plugins: STRIPE_PLUGINS,
    };

    examples[kind] = example;
  }

  return examples;
}
