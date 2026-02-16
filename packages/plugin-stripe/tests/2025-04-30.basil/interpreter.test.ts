import { coreInterpreter, foldAST, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it, vi } from "vitest";
import { stripeInterpreter } from "../../src";
import { stripe } from "../../src/2025-04-30.basil";
import { createStripeInterpreter, type StripeClient } from "../../src/2025-04-30.basil/interpreter";

const app = mvfm(num, str, stripe({ apiKey: "sk_test_123" }));

describe("stripe interpreter: default export", () => {
  it("throws when STRIPE_API_KEY is missing", async () => {
    vi.stubEnv("STRIPE_API_KEY", "");
    const prog = app(($) => $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }));
    const combined = { ...stripeInterpreter, ...coreInterpreter };
    await expect(foldAST(combined, prog.ast.result)).rejects.toThrow(/STRIPE_API_KEY/);
    vi.unstubAllEnvs();
  });

  it("exports a default ready-to-use interpreter when STRIPE_API_KEY is set", () => {
    vi.stubEnv("STRIPE_API_KEY", "sk_test_default");
    expect(typeof stripeInterpreter["stripe/create_payment_intent"]).toBe("function");
    vi.unstubAllEnvs();
  });
});

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: Array<{ method: string; path: string; params?: Record<string, unknown> }> = [];
  const ast = injectInput(prog.ast, input);
  const mockClient: StripeClient = {
    async request(method: string, path: string, params?: Record<string, unknown>) {
      captured.push({ method, path, params });
      return { id: "mock_id", object: "mock" };
    },
  };
  const combined = { ...createStripeInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, ast.result);
  return { result, captured };
}

// ============================================================
// Payment Intents
// ============================================================

describe("stripe interpreter: create_payment_intent", () => {
  it("yields POST /v1/payment_intents with correct params", async () => {
    const prog = app(($) => $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents");
    expect(captured[0].params).toEqual({ amount: 2000, currency: "usd" });
  });
});

describe("stripe interpreter: retrieve_payment_intent", () => {
  it("yields GET /v1/payment_intents/{id}", async () => {
    const prog = app(($) => $.stripe.paymentIntents.retrieve("pi_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: confirm_payment_intent", () => {
  it("yields POST /v1/payment_intents/{id}/confirm with params", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.confirm("pi_123", { payment_method: "pm_abc" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/payment_intents/pi_123/confirm");
    expect(captured[0].params).toEqual({ payment_method: "pm_abc" });
  });

  it("yields POST without params when omitted", async () => {
    const prog = app(($) => $.stripe.paymentIntents.confirm("pi_123"));
    const { captured } = await run(prog);
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
  it("yields POST /v1/customers with correct params", async () => {
    const prog = app(($) => $.stripe.customers.create({ email: "test@example.com" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ email: "test@example.com" });
  });
});

describe("stripe interpreter: retrieve_customer", () => {
  it("yields GET /v1/customers/{id}", async () => {
    const prog = app(($) => $.stripe.customers.retrieve("cus_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers/cus_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: update_customer", () => {
  it("yields POST /v1/customers/{id} with params", async () => {
    const prog = app(($) => $.stripe.customers.update("cus_123", { name: "Updated Name" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/customers/cus_123");
    expect(captured[0].params).toEqual({ name: "Updated Name" });
  });
});

describe("stripe interpreter: list_customers", () => {
  it("yields GET /v1/customers with params", async () => {
    const prog = app(($) => $.stripe.customers.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/customers");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET /v1/customers with undefined params when omitted", async () => {
    const prog = app(($) => $.stripe.customers.list());
    const { captured } = await run(prog);
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
  it("yields POST /v1/charges with correct params", async () => {
    const prog = app(($) =>
      $.stripe.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toEqual({ amount: 5000, currency: "usd", source: "tok_visa" });
  });
});

describe("stripe interpreter: retrieve_charge", () => {
  it("yields GET /v1/charges/{id}", async () => {
    const prog = app(($) => $.stripe.charges.retrieve("ch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges/ch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("stripe interpreter: list_charges", () => {
  it("yields GET /v1/charges with params", async () => {
    const prog = app(($) => $.stripe.charges.list({ limit: 25 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toEqual({ limit: 25 });
  });

  it("yields GET /v1/charges with undefined params when omitted", async () => {
    const prog = app(($) => $.stripe.charges.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/charges");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("stripe interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ amount: "number", currency: "string" }, ($) =>
      $.stripe.paymentIntents.create({
        amount: $.input.amount,
        currency: $.input.currency,
      }),
    );
    const { captured } = await run(prog, { amount: 3000, currency: "eur" });
    expect(captured).toHaveLength(1);
    expect(captured[0].params).toEqual({ amount: 3000, currency: "eur" });
  });

  it("resolves input id for retrieve", async () => {
    const prog = app({ piId: "string" }, ($) => $.stripe.paymentIntents.retrieve($.input.piId));
    const { captured } = await run(prog, { piId: "pi_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/v1/payment_intents/pi_dynamic_456");
  });
});

// ============================================================
// Mock return value
// ============================================================

describe("stripe interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.stripe.customers.retrieve("cus_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
