/**
 * Generates documentation examples for all Stripe plugin node kinds.
 *
 * Uses the registry OpDef data (kind, argPattern) directly so generated
 * examples always match the actual constructor signatures.
 */

import { flatResourceDefs, stripe } from "@mvfm/plugin-stripe";
import type { ExampleEntry, NamespaceIndex, NodeExample } from "./types";

const STRIPE_PLUGINS = ["@mvfm/plugin-stripe"];

const plugin = stripe({ apiKey: "sk_test_docs" });
const ctorsTree = plugin.ctors.stripe as Record<string, unknown>;

// ---- Kind -> accessor path mapping ----

interface KindAccessor {
  accessor: string;
  argPattern: string;
}

function findAccessorForKind(kind: string): string | null {
  function walk(obj: Record<string, unknown>, path: string[]): string | null {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "function") {
        try {
          const r = (value as Function)("_d", "_d", { _d: 1 });
          if (r && typeof r === "object" && "__kind" in r && r.__kind === kind) {
            return [...path, key].join(".");
          }
        } catch {
          /* skip */
        }
      } else if (typeof value === "object" && value !== null) {
        const found = walk(value as Record<string, unknown>, [...path, key]);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(ctorsTree, []);
}

// ---- Code generation per arg pattern ----

function humanize(kind: string): string {
  return kind
    .replace("stripe/", "")
    .split("_")
    .join(" ")
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

function makeCtorCall(accessor: string, argPattern: string): string {
  switch (argPattern) {
    case "":
      return `${accessor}()`;
    case "params":
    case "singleton,params":
      return `${accessor}({})`;
    case "id":
    case "del":
      return `${accessor}("id_abc123")`;
    case "id,params":
      return `${accessor}("id_abc123", { metadata: { key: "value" } })`;
    case "id,params?":
      return `${accessor}("id_abc123")`;
    case "params?":
      return `${accessor}({ limit: 3 })`;
    case "id,childId":
    case "id,childId,del":
      return `${accessor}("parent_abc123", "child_abc123")`;
    case "id,childId,params":
      return `${accessor}("parent_abc123", "child_abc123", {})`;
    case "id,nestedParams":
      return `${accessor}("parent_abc123", {})`;
    case "id,nestedParams?":
      return `${accessor}("parent_abc123", { limit: 3 })`;
    default:
      return `${accessor}("id_abc123")`;
  }
}

function makeCodeString(accessor: string, argPattern: string): string {
  const call = makeCtorCall(accessor, argPattern);
  return [
    "const app = mvfm(prelude, console_, stripe_);",
    "const prog = app({}, ($) => {",
    `  const result = $.stripe.${call};`,
    "  return $.console.log(result);",
    "});",
    "await fold(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);",
  ].join("\n");
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
  const kindCount = plugin.kinds ? Object.keys(plugin.kinds).length : 469;
  return {
    content: [
      "<p>The <strong>Stripe plugin</strong> provides type-safe access to the ",
      '<a href="https://stripe.com/docs/api">Stripe API</a>. ',
      "Every API resource and method is available as a node kind, with support for ",
      "all CRUD operations, list/search, and resource-specific actions.</p>",
      "<p>Methods are accessed via the <code>$.stripe</code> namespace using ",
      "the same resource structure as the Stripe SDK (e.g. ",
      "<code>$.stripe.paymentIntents.create()</code>).</p>",
      `<p>The plugin ships with ${kindCount} node kinds covering the full `,
      "Stripe API surface area.</p>",
    ].join(""),
  };
}

// ---- Main generator ----

/** Generate all Stripe documentation examples. */
export function generateStripeExamples(): Record<string, ExampleEntry> {
  const examples: Record<string, ExampleEntry> = {};

  // Namespace landing page
  examples.stripe = buildNamespaceIndex();

  // Build kind -> argPattern map from registry data
  const kindPatterns = new Map<string, string>();
  for (const def of flatResourceDefs()) {
    for (const op of Object.values(def)) {
      kindPatterns.set(op.kind, op.argPattern);
    }
  }

  for (const [kind, argPattern] of kindPatterns) {
    if (HAND_CRAFTED.has(kind)) continue;

    const accessor = findAccessorForKind(kind);
    if (!accessor) continue;

    const desc = humanize(kind);
    const code = makeCodeString(accessor, argPattern);

    const example: NodeExample = {
      description: desc,
      code,
      plugins: STRIPE_PLUGINS,
    };

    examples[kind] = example;
  }

  return examples;
}
