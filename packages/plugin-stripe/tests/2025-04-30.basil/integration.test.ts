import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import Stripe from "stripe";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stripe as stripePlugin } from "../../src/2025-04-30.basil";
import { wrapStripeSdk } from "../../src/2025-04-30.basil/client-stripe-sdk";
import { createStripeInterpreter } from "../../src/2025-04-30.basil/interpreter";

let container: StartedTestContainer;
let sdk: Stripe;

const plugin = stripePlugin({ apiKey: "sk_test_fake" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
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
// Payment Intents
// ============================================================

describe("stripe integration: payment intents", () => {
  it("create payment intent", async () => {
    const expr = $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("payment_intent");
    expect(result.id).toBeDefined();
  });

  it("retrieve payment intent", async () => {
    const expr = $.stripe.paymentIntents.retrieve("pi_xxxxxxxxxxxxx");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("payment_intent");
  });

  it("confirm payment intent", async () => {
    const expr = $.stripe.paymentIntents.confirm("pi_xxxxxxxxxxxxx", {
      payment_method: "pm_card_visa",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("payment_intent");
  });
});

// ============================================================
// Customers
// ============================================================

describe("stripe integration: customers", () => {
  it("create customer", async () => {
    const expr = $.stripe.customers.create({ email: "test@example.com" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("customer");
    expect(result.id).toBeDefined();
  });

  it("retrieve customer", async () => {
    const expr = $.stripe.customers.retrieve("cus_xxxxxxxxxxxxx");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("customer");
  });

  it("update customer", async () => {
    const expr = $.stripe.customers.update("cus_xxxxxxxxxxxxx", { name: "Updated Name" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("customer");
  });

  it("list customers", async () => {
    const expr = $.stripe.customers.list({ limit: 10 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Charges
// ============================================================

describe("stripe integration: charges", () => {
  it("create charge", async () => {
    const expr = $.stripe.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });

  it("retrieve charge", async () => {
    const expr = $.stripe.charges.retrieve("ch_xxxxxxxxxxxxx");
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("charge");
  });

  it("list charges", async () => {
    const expr = $.stripe.charges.list({ limit: 25 });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Chaining: create customer then create charge with customer ID
// ============================================================

describe("stripe integration: chaining", () => {
  it("create customer then charge with customer id", async () => {
    const customer = $.stripe.customers.create({ email: "chain@test.com" });
    const expr = $.stripe.charges.create({
      amount: 3000,
      currency: "usd",
      customer: (customer as Record<string, unknown>).id,
      source: "tok_visa",
    });
    const result = (await run(expr)) as Record<string, unknown>;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });
});
