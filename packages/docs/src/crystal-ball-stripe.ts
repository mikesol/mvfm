/** Generic crystal-ball mock client for the Stripe plugin. */

let stripeIdCounter = 0;
function nextStripeId(prefix: string): string {
  return `${prefix}_crystal_ball_${String(++stripeIdCounter).padStart(3, "0")}`;
}

/** Singularize a Stripe resource path segment: `payment_intents` -> `payment_intent`. */
function singularize(s: string): string {
  if (s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.endsWith("ses") && !s.endsWith("sses")) return s.slice(0, -1);
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

/**
 * Derive the Stripe `object` type string from path segments.
 * Namespaced resources are dot-joined: `checkout.session`, `issuing.card`.
 */
function deriveObjectType(segments: string[]): string {
  // Filter out segments that look like IDs (contain _ followed by alphanumeric)
  const resources = segments.filter((s) => !/^[a-z]+_[A-Za-z0-9]/.test(s));
  if (resources.length === 1) return singularize(resources[0]);
  if (resources.length >= 2) {
    return resources.map((r) => singularize(r)).join(".");
  }
  return singularize(segments[segments.length - 1]);
}

/** Check if the last segment looks like a Stripe ID (prefix_chars pattern). */
function hasIdSuffix(segments: string[]): boolean {
  const last = segments[segments.length - 1];
  return /^[a-z]+_/.test(last);
}

/** Extract a Stripe ID from path segments. */
function extractId(segments: string[]): string | undefined {
  return segments.find((s) => /^[a-z]+_[A-Za-z0-9]/.test(s));
}

/** Short ID prefix from an object type: `payment_intent` -> `pi`. */
function idPrefix(objectType: string): string {
  const base = objectType.split(".").pop() ?? objectType;
  const parts = base.split("_");
  if (parts.length === 1) return parts[0].slice(0, 3);
  return parts.map((p) => p[0]).join("");
}

/** Reflect scalar params back in the response (mirrors stripe-mock behavior). */
function reflectParams(params?: Record<string, unknown>): Record<string, unknown> {
  if (!params) return {};
  const reflected: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      reflected[k] = v;
    }
  }
  return reflected;
}

/**
 * Creates a generic Stripe mock client that handles any Stripe API path.
 *
 * Uses path-based pattern matching to derive object types, IDs, and response
 * shapes. Scalar params are reflected back in responses (like stripe-mock).
 */
export function createCrystalBallStripeClient(): import("@mvfm/plugin-stripe").StripeClient {
  return {
    async request(method: string, path: string, params?: Record<string, unknown>) {
      const segments = path.replace("/v1/", "").split("/");
      const objectType = deriveObjectType(segments);
      const prefix = idPrefix(objectType);

      if (method === "DELETE") {
        const id = extractId(segments) ?? `${prefix}_crystal_ball_001`;
        return { id, object: objectType, deleted: true };
      }

      if (method === "GET" && !hasIdSuffix(segments)) {
        // Singleton retrieve (e.g. /v1/balance, /v1/tax/settings)
        const last = segments[segments.length - 1];
        if (!last.endsWith("s") && segments.length <= 2) {
          return { object: objectType, created: 1700000000, livemode: false };
        }
        // List endpoint
        return {
          object: "list",
          data: [{ id: `${prefix}_crystal_ball_001`, object: objectType, created: 1700000000 }],
          has_more: false,
          url: path,
        };
      }

      if (method === "GET") {
        const id = extractId(segments) ?? `${prefix}_crystal_ball_001`;
        return { id, object: objectType, created: 1700000000, livemode: false };
      }

      // POST — create, update, or action
      const id = hasIdSuffix(segments) ? extractId(segments)! : nextStripeId(prefix);
      return {
        id,
        object: objectType,
        created: 1700000000,
        livemode: false,
        ...reflectParams(params),
      };
    },
  };
}
