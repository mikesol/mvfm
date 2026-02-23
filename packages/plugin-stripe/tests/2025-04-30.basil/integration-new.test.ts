import {
  boolPlugin,
  composeDollar,
  createApp,
  defaults,
  fold,
  numPlugin,
  strPlugin,
} from "@mvfm/core";
import Stripe from "stripe";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stripe as stripePlugin } from "../../src/2025-04-30.basil";
import { wrapStripeSdk } from "../../src/2025-04-30.basil/client-stripe-sdk";
import { createStripeInterpreter } from "../../src/2025-04-30.basil/interpreter";

let container: StartedTestContainer;
let sdk: Stripe;

const plugin = stripePlugin({ apiKey: "sk_test_fake" });
const plugins = [numPlugin, strPlugin, boolPlugin, plugin] as const;
const $ = composeDollar(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const client = wrapStripeSdk(sdk);
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = {
    ...defaults(plugins, {
      stripe: createStripeInterpreter(client),
    }),
    "core/access": async function* (entry: import("@mvfm/core").RuntimeEntry) {
      const parent = (yield 0) as Record<string, unknown>;
      return parent[entry.out as string];
    },
  };
  return await fold(nexpr, interp);
}

beforeAll(async () => {
  container = await new GenericContainer("stripe/stripe-mock:latest")
    .withExposedPorts(12111)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(12111);

  sdk = new Stripe("sk_test_fake", {
    host,
    port: String(port),
    protocol: "http",
  });
}, 60000);

afterAll(async () => {
  await container.stop();
});

// ============================================================
// Refunds
// ============================================================

describe("stripe integration: refunds", () => {
  it("create refund", async () => {
    const result = (await run(
      $.stripe.refunds.create({ charge: "ch_xxxxxxxxxxxxx" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("refund");
    expect(result.id).toBeDefined();
  });

  it("retrieve refund", async () => {
    const result = (await run(
      $.stripe.refunds.retrieve("re_xxxxxxxxxxxxx"),
    )) as Record<string, unknown>;
    expect(result.object).toBe("refund");
  });
});

// ============================================================
// Subscriptions
// ============================================================

describe("stripe integration: subscriptions", () => {
  it("create subscription", async () => {
    const result = (await run(
      $.stripe.subscriptions.create({
        customer: "cus_xxxxxxxxxxxxx",
        items: [{ price: "price_xxxxxxxxxxxxx" }],
      }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("subscription");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Products
// ============================================================

describe("stripe integration: products", () => {
  it("create product", async () => {
    const result = (await run(
      $.stripe.products.create({ name: "Integration Test Product" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("product");
    expect(result.id).toBeDefined();
  });

  it("list products", async () => {
    const result = (await run($.stripe.products.list({ limit: 5 }))) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Prices
// ============================================================

describe("stripe integration: prices", () => {
  it("create price", async () => {
    const result = (await run(
      $.stripe.prices.create({ unit_amount: 1000, currency: "usd", product: "prod_xxxxxxxxxxxxx" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("price");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Coupons
// ============================================================

describe("stripe integration: coupons", () => {
  it("create coupon", async () => {
    const result = (await run(
      $.stripe.coupons.create({ percent_off: 25, duration: "once" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("coupon");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Payment Methods
// ============================================================

describe("stripe integration: payment methods", () => {
  it("create payment method", async () => {
    const result = (await run(
      $.stripe.paymentMethods.create({ type: "card" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("payment_method");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Accounts
// ============================================================

describe("stripe integration: accounts", () => {
  it("create account", async () => {
    const result = (await run(
      $.stripe.accounts.create({ type: "express" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("account");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Checkout Sessions
// ============================================================

describe("stripe integration: checkout sessions", () => {
  it("create checkout session", async () => {
    const result = (await run(
      $.stripe.checkout.sessions.create({
        mode: "payment",
        success_url: "https://example.com/success",
        line_items: [{ price: "price_xxxxxxxxxxxxx", quantity: 1 }],
      }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("checkout.session");
    expect(result.id).toBeDefined();
  });
});

// ============================================================
// Invoices
// ============================================================

describe("stripe integration: invoices", () => {
  it("create invoice", async () => {
    const result = (await run(
      $.stripe.invoices.create({ customer: "cus_xxxxxxxxxxxxx" }),
    )) as Record<string, unknown>;
    expect(result.object).toBe("invoice");
    expect(result.id).toBeDefined();
  });
});
