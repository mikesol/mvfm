import {
  boolPlugin,
  composeDollar,
  createApp,
  defaults,
  fold,
  numPlugin,
  strPlugin,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { stripe } from "../../src/2025-04-30.basil";
import { createStripeInterpreter, type StripeClient } from "../../src/2025-04-30.basil/interpreter";

const plugin = stripe({ apiKey: "sk_test_123" });
const plugins = [numPlugin, strPlugin, boolPlugin, plugin] as const;
const $ = composeDollar(...plugins);
const app = createApp(...plugins);

function mockClient() {
  const captured: Array<{ method: string; path: string; params?: Record<string, unknown> }> = [];
  const client: StripeClient = {
    async request(method, path, params) {
      captured.push({ method, path, params });
      return { id: "mock_id", object: "mock" };
    },
  };
  return { client, captured };
}

async function run(expr: unknown) {
  const { client, captured } = mockClient();
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, { stripe: createStripeInterpreter(client) });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Registry arg pattern tests — constructor shape
// ============================================================

describe("registry: constructor shapes", () => {
  const api = plugin.ctors.stripe;

  it('"params" pattern: refunds.create', () => {
    const expr = api.refunds.create({ charge: "ch_123" });
    expect(expr.__kind).toBe("stripe/create_refund");
    expect(expr.__args).toHaveLength(1);
    expect((expr.__args[0] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"id" pattern: refunds.retrieve', () => {
    const expr = api.refunds.retrieve("re_123");
    expect(expr.__kind).toBe("stripe/retrieve_refund");
    expect(expr.__args).toEqual(["re_123"]);
  });

  it('"id,params" pattern: refunds.update', () => {
    const expr = api.refunds.update("re_123", { metadata: {} });
    expect(expr.__kind).toBe("stripe/update_refund");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("re_123");
    expect((expr.__args[1] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"id,params?" pattern without params: paymentIntents.cancel', () => {
    const expr = api.paymentIntents.cancel("pi_123");
    expect(expr.__kind).toBe("stripe/cancel_payment_intent");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("pi_123");
  });

  it('"id,params?" pattern with params: paymentIntents.cancel', () => {
    const expr = api.paymentIntents.cancel("pi_123", { cancellation_reason: "requested" });
    expect(expr.__kind).toBe("stripe/cancel_payment_intent");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("pi_123");
    expect((expr.__args[1] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"params?" pattern without params: paymentIntents.list', () => {
    const expr = api.paymentIntents.list();
    expect(expr.__kind).toBe("stripe/list_payment_intents");
    expect(expr.__args).toHaveLength(0);
  });

  it('"params?" pattern with params: paymentIntents.list', () => {
    const expr = api.paymentIntents.list({ limit: 5 });
    expect(expr.__kind).toBe("stripe/list_payment_intents");
    expect(expr.__args).toHaveLength(1);
    expect((expr.__args[0] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"del" pattern: coupons.del', () => {
    const expr = api.coupons.del("co_123");
    expect(expr.__kind).toBe("stripe/del_coupon");
    expect(expr.__args).toEqual(["co_123"]);
  });

  it('"" (singleton) pattern: balance.retrieve', () => {
    const expr = api.balance.retrieve();
    expect(expr.__kind).toBe("stripe/retrieve_balance");
    expect(expr.__args).toHaveLength(0);
  });

  it('"singleton,params" pattern: balanceSettings.update', () => {
    const expr = api.balanceSettings.update({ payouts: {} });
    expect(expr.__kind).toBe("stripe/update_balance_settings");
    expect(expr.__args).toHaveLength(1);
    expect((expr.__args[0] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"id,childId" pattern: customers.retrieveSource', () => {
    const expr = api.customers.retrieveSource("cus_123", "src_456");
    expect(expr.__kind).toBe("stripe/retrieve_customer_source");
    expect(expr.__args).toEqual(["cus_123", "src_456"]);
  });

  it('"id,childId,params" pattern: customers.updateSource', () => {
    const expr = api.customers.updateSource("cus_123", "src_456", { metadata: {} });
    expect(expr.__kind).toBe("stripe/update_customer_source");
    expect(expr.__args).toHaveLength(3);
    expect(expr.__args[0]).toBe("cus_123");
    expect(expr.__args[1]).toBe("src_456");
    expect((expr.__args[2] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"id,nestedParams" pattern: customers.createSource', () => {
    const expr = api.customers.createSource("cus_123", { source: "tok_visa" });
    expect(expr.__kind).toBe("stripe/create_customer_source");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("cus_123");
    expect((expr.__args[1] as { __kind: string }).__kind).toBe("stripe/record");
  });

  it('"id,nestedParams?" pattern: customers.listSources', () => {
    const expr = api.customers.listSources("cus_123");
    expect(expr.__kind).toBe("stripe/list_customer_sources");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("cus_123");
  });

  it('"id,childId,del" pattern: customers.deleteSource', () => {
    const expr = api.customers.deleteSource("cus_123", "src_456");
    expect(expr.__kind).toBe("stripe/delete_customer_source");
    expect(expr.__args).toEqual(["cus_123", "src_456"]);
  });
});

// ============================================================
// Registry arg pattern tests — handler HTTP calls
// ============================================================

describe("registry: handler HTTP calls", () => {
  it('"params": POST /v1/refunds', async () => {
    const { captured } = await run($.stripe.refunds.create({ charge: "ch_123" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/refunds" });
    expect(captured[0].params).toEqual({ charge: "ch_123" });
  });

  it('"id": GET /v1/refunds/{id}', async () => {
    const { captured } = await run($.stripe.refunds.retrieve("re_123"));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/refunds/re_123" });
    expect(captured[0].params).toBeUndefined();
  });

  it('"id,params": POST /v1/refunds/{id}', async () => {
    const { captured } = await run($.stripe.refunds.update("re_123", { metadata: {} }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/refunds/re_123" });
    expect(captured[0].params).toEqual({ metadata: {} });
  });

  it('"id,params?" without params: POST /v1/payment_intents/{id}/cancel', async () => {
    const { captured } = await run($.stripe.paymentIntents.cancel("pi_123"));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/payment_intents/pi_123/cancel" });
    expect(captured[0].params).toBeUndefined();
  });

  it('"id,params?" with params: POST /v1/payment_intents/{id}/cancel', async () => {
    const expr = $.stripe.paymentIntents.cancel("pi_123", { cancellation_reason: "requested" });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/payment_intents/pi_123/cancel" });
    expect(captured[0].params).toEqual({ cancellation_reason: "requested" });
  });

  it('"params?" without params: GET /v1/payment_intents', async () => {
    const { captured } = await run($.stripe.paymentIntents.list());
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/payment_intents" });
    expect(captured[0].params).toBeUndefined();
  });

  it('"params?" with params: GET /v1/payment_intents', async () => {
    const { captured } = await run($.stripe.paymentIntents.list({ limit: 5 }));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/payment_intents" });
    expect(captured[0].params).toEqual({ limit: 5 });
  });

  it('"del": DELETE /v1/coupons/{id}', async () => {
    const { captured } = await run($.stripe.coupons.del("co_123"));
    expect(captured[0]).toMatchObject({ method: "DELETE", path: "/v1/coupons/co_123" });
  });

  it('"" singleton: GET /v1/balance', async () => {
    const { captured } = await run($.stripe.balance.retrieve());
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/balance" });
  });

  it('"singleton,params": POST /v1/balance/settings', async () => {
    const { captured } = await run($.stripe.balanceSettings.update({ payouts: {} }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/balance/settings" });
    expect(captured[0].params).toEqual({ payouts: {} });
  });

  it('"id,childId": GET /v1/customers/{id}/sources/{childId}', async () => {
    const { captured } = await run($.stripe.customers.retrieveSource("cus_123", "src_456"));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/customers/cus_123/sources/src_456" });
  });

  it('"id,childId,params": POST /v1/customers/{id}/sources/{childId}', async () => {
    const expr = $.stripe.customers.updateSource("cus_123", "src_456", { metadata: {} });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/customers/cus_123/sources/src_456" });
    expect(captured[0].params).toEqual({ metadata: {} });
  });

  it('"id,nestedParams": POST /v1/customers/{id}/sources', async () => {
    const { captured } = await run($.stripe.customers.createSource("cus_123", { source: "tok_visa" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/customers/cus_123/sources" });
    expect(captured[0].params).toEqual({ source: "tok_visa" });
  });

  it('"id,nestedParams?": GET /v1/customers/{id}/sources', async () => {
    const { captured } = await run($.stripe.customers.listSources("cus_123"));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/customers/cus_123/sources" });
    expect(captured[0].params).toBeUndefined();
  });

  it('"id,childId,del": DELETE /v1/customers/{id}/sources/{childId}', async () => {
    const { captured } = await run($.stripe.customers.deleteSource("cus_123", "src_456"));
    expect(captured[0]).toMatchObject({ method: "DELETE", path: "/v1/customers/cus_123/sources/src_456" });
  });
});
