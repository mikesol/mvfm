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
// Refunds
// ============================================================

describe("stripe interpreter: refunds", () => {
  it("create refund", async () => {
    const { captured } = await run($.stripe.refunds.create({ charge: "ch_123" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/refunds" });
    expect(captured[0].params).toEqual({ charge: "ch_123" });
  });

  it("retrieve refund", async () => {
    const { captured } = await run($.stripe.refunds.retrieve("re_123"));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/refunds/re_123" });
  });
});

// ============================================================
// Subscriptions
// ============================================================

describe("stripe interpreter: subscriptions", () => {
  it("create subscription", async () => {
    const expr = $.stripe.subscriptions.create({
      customer: "cus_123",
      items: [{ price: "price_1" }],
    });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/subscriptions" });
  });

  it("cancel subscription (del pattern)", async () => {
    const { captured } = await run($.stripe.subscriptions.cancel("sub_123"));
    expect(captured[0]).toMatchObject({ method: "DELETE", path: "/v1/subscriptions/sub_123" });
  });
});

// ============================================================
// Invoices
// ============================================================

describe("stripe interpreter: invoices", () => {
  it("create invoice", async () => {
    const { captured } = await run($.stripe.invoices.create({ customer: "cus_123" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/invoices" });
  });

  it("finalize invoice", async () => {
    const { captured } = await run($.stripe.invoices.finalizeInvoice("in_123"));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/invoices/in_123/finalize" });
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Products
// ============================================================

describe("stripe interpreter: products", () => {
  it("create product", async () => {
    const { captured } = await run($.stripe.products.create({ name: "My Product" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/products" });
    expect(captured[0].params).toEqual({ name: "My Product" });
  });

  it("search products", async () => {
    const { captured } = await run($.stripe.products.search({ query: "active:'true'" }));
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/products/search" });
  });
});

// ============================================================
// Accounts
// ============================================================

describe("stripe interpreter: accounts", () => {
  it("create account", async () => {
    const { captured } = await run($.stripe.accounts.create({ type: "express" }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/accounts" });
  });

  it("retrieveCurrent (singleton)", async () => {
    const { captured } = await run($.stripe.accounts.retrieveCurrent());
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/account" });
  });
});

// ============================================================
// Checkout Sessions
// ============================================================

describe("stripe interpreter: checkout sessions", () => {
  it("create checkout session", async () => {
    const expr = $.stripe.checkout.sessions.create({
      mode: "payment",
      success_url: "https://x.com",
    });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/checkout/sessions" });
  });

  it("expire checkout session", async () => {
    const { captured } = await run($.stripe.checkout.sessions.expire("cs_123"));
    expect(captured[0]).toMatchObject({
      method: "POST",
      path: "/v1/checkout/sessions/cs_123/expire",
    });
  });
});

// ============================================================
// Issuing Cards
// ============================================================

describe("stripe interpreter: issuing cards", () => {
  it("create issuing card", async () => {
    const expr = $.stripe.issuing.cards.create({
      cardholder: "ich_123",
      currency: "usd",
      type: "virtual",
    });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/issuing/cards" });
  });
});

// ============================================================
// Treasury Financial Accounts
// ============================================================

describe("stripe interpreter: treasury financial accounts", () => {
  it("create treasury financial account", async () => {
    const expr = $.stripe.treasury.financialAccounts.create({
      supported_currencies: ["usd"],
      features: {},
    });
    const { captured } = await run(expr);
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/treasury/financial_accounts" });
  });
});

// ============================================================
// Balance (singleton)
// ============================================================

describe("stripe interpreter: balance", () => {
  it("retrieve balance", async () => {
    const { captured } = await run($.stripe.balance.retrieve());
    expect(captured[0]).toMatchObject({ method: "GET", path: "/v1/balance" });
  });
});

// ============================================================
// Nested resources
// ============================================================

describe("stripe interpreter: nested resources", () => {
  it("customers.createSource (id,nestedParams)", async () => {
    const { captured } = await run(
      $.stripe.customers.createSource("cus_123", { source: "tok_visa" }),
    );
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/customers/cus_123/sources" });
    expect(captured[0].params).toEqual({ source: "tok_visa" });
  });

  it("customers.retrieveSource (id,childId)", async () => {
    const { captured } = await run($.stripe.customers.retrieveSource("cus_123", "src_456"));
    expect(captured[0]).toMatchObject({
      method: "GET",
      path: "/v1/customers/cus_123/sources/src_456",
    });
  });

  it("transfers.createReversal (id,nestedParams)", async () => {
    const { captured } = await run($.stripe.transfers.createReversal("tr_123", { amount: 100 }));
    expect(captured[0]).toMatchObject({ method: "POST", path: "/v1/transfers/tr_123/reversals" });
    expect(captured[0].params).toEqual({ amount: 100 });
  });
});

// ============================================================
// Coupons (del)
// ============================================================

describe("stripe interpreter: coupons", () => {
  it("del coupon", async () => {
    const { captured } = await run($.stripe.coupons.del("co_123"));
    expect(captured[0]).toMatchObject({ method: "DELETE", path: "/v1/coupons/co_123" });
  });
});
