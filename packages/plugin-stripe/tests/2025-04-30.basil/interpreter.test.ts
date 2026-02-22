import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { stripeInterpreter } from "../../src";
import { stripe } from "../../src/2025-04-30.basil";
import { createStripeInterpreter, type StripeClient } from "../../src/2025-04-30.basil/interpreter";

const plugin = stripe({ apiKey: "sk_test_123" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    method: string;
    path: string;
    params?: Record<string, unknown>;
  }> = [];
  const mockClient: StripeClient = {
    async request(method, path, params) {
      captured.push({ method, path, params });
      return { id: "mock_id", object: "mock" };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    stripe: createStripeInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Default interpreter
// ============================================================

describe("stripe interpreter: default export", () => {
  it("stripeInterpreter throws when STRIPE_API_KEY is missing", async () => {
    vi.stubEnv("STRIPE_API_KEY", "");
    const expr = $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    const nexpr = app(expr as Parameters<typeof app>[0]);
    const stdInterp = defaults([numPluginU, strPluginU, boolPluginU]);
    const combined = { ...stdInterp, ...stripeInterpreter };
    await expect(fold(nexpr, combined)).rejects.toThrow(/STRIPE_API_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter with STRIPE_API_KEY", () => {
    vi.stubEnv("STRIPE_API_KEY", "sk_test_default");
    expect(typeof stripeInterpreter["stripe/create_payment_intent"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

// ============================================================
// Payment Intents
// ============================================================

describe("stripe interpreter: create_payment_intent", () => {
  it("calls POST /v1/payment_intents with correct params", async () => {
    const expr = $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents");
    expect(captured[0].params).toEqual({ amount: 2000, currency: "usd" });
  });
});

describe("stripe interpreter: retrieve_payment_intent", () => {
  it("calls GET /v1/payment_intents/{id}", async () => {
    const expr = $.stripe.paymentIntents.retrieve("pi_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: confirm_payment_intent", () => {
  it("calls POST /v1/payment_intents/{id}/confirm with params", async () => {
    const expr = $.stripe.paymentIntents.confirm("pi_123", { payment_method: "pm_abc" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123/confirm");
    expect(captured[0].params).toEqual({ payment_method: "pm_abc" });
  });

  it("calls POST without params when omitted", async () => {
    const expr = $.stripe.paymentIntents.confirm("pi_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123/confirm");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Customers
// ============================================================

describe("stripe interpreter: create_customer", () => {
  it("calls POST /v1/customers with correct params", async () => {
    const expr = $.stripe.customers.create({ email: "test@example.com" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ email: "test@example.com" });
  });
});

describe("stripe interpreter: retrieve_customer", () => {
  it("calls GET /v1/customers/{id}", async () => {
    const expr = $.stripe.customers.retrieve("cus_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers/cus_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: update_customer", () => {
  it("calls POST /v1/customers/{id} with params", async () => {
    const expr = $.stripe.customers.update("cus_123", { name: "Updated Name" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers/cus_123");
    expect(captured[0].params).toEqual({ name: "Updated Name" });
  });
});

describe("stripe interpreter: list_customers", () => {
  it("calls GET /v1/customers with params", async () => {
    const expr = $.stripe.customers.list({ limit: 10 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("calls GET /v1/customers with undefined params when omitted", async () => {
    const expr = $.stripe.customers.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Charges
// ============================================================

describe("stripe interpreter: create_charge", () => {
  it("calls POST /v1/charges with correct params", async () => {
    const expr = $.stripe.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toEqual({ amount: 5000, currency: "usd", source: "tok_visa" });
  });
});

describe("stripe interpreter: retrieve_charge", () => {
  it("calls GET /v1/charges/{id}", async () => {
    const expr = $.stripe.charges.retrieve("ch_123");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges/ch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: list_charges", () => {
  it("calls GET /v1/charges with params", async () => {
    const expr = $.stripe.charges.list({ limit: 25 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toEqual({ limit: 25 });
  });

  it("calls GET /v1/charges with undefined params when omitted", async () => {
    const expr = $.stripe.charges.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Return value
// ============================================================

describe("stripe interpreter: return value", () => {
  it("returns the client response as the result", async () => {
    const expr = $.stripe.customers.retrieve("cus_123");
    const { result } = await run(expr);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
