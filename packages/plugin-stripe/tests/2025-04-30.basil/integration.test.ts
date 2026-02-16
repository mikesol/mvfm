import type { Program } from "@mvfm/core";
import {
  coreInterpreter,
  error,
  errorInterpreter,
  fiber,
  fiberInterpreter,
  injectInput,
  mvfm,
  num,
  numInterpreter,
  str,
  strInterpreter,
} from "@mvfm/core";
import Stripe from "stripe";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stripe as stripePlugin } from "../../src/2025-04-30.basil";
import { wrapStripeSdk } from "../../src/2025-04-30.basil/client-stripe-sdk";
import { serverEvaluate } from "../../src/2025-04-30.basil/handler.server";
import { createStripeInterpreter } from "../../src/2025-04-30.basil/interpreter";

let container: StartedTestContainer;
let sdk: Stripe;

const app = mvfm(num, str, stripePlugin({ apiKey: "sk_test_fake" }), fiber, error);

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const injected = injectInput(prog, input);
  const client = wrapStripeSdk(sdk);
  const baseInterpreter = {
    ...createStripeInterpreter(client),
    ...errorInterpreter,
    ...fiberInterpreter,
    ...coreInterpreter,
    ...numInterpreter,
    ...strInterpreter,
  };
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(injected.ast.result);
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
    const prog = app(($) => $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
    expect(result.id).toBeDefined();
  });

  it("retrieve payment intent", async () => {
    const prog = app(($) => $.stripe.paymentIntents.retrieve("pi_xxxxxxxxxxxxx"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
  });

  it("confirm payment intent", async () => {
    const prog = app(($) =>
      $.stripe.paymentIntents.confirm("pi_xxxxxxxxxxxxx", {
        payment_method: "pm_card_visa",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("payment_intent");
  });
});

// ============================================================
// Customers
// ============================================================

describe("stripe integration: customers", () => {
  it("create customer", async () => {
    const prog = app(($) => $.stripe.customers.create({ email: "test@example.com" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
    expect(result.id).toBeDefined();
  });

  it("retrieve customer", async () => {
    const prog = app(($) => $.stripe.customers.retrieve("cus_xxxxxxxxxxxxx"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
  });

  it("update customer", async () => {
    const prog = app(($) =>
      $.stripe.customers.update("cus_xxxxxxxxxxxxx", { name: "Updated Name" }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("customer");
  });

  it("list customers", async () => {
    const prog = app(($) => $.stripe.customers.list({ limit: 10 }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Charges
// ============================================================

describe("stripe integration: charges", () => {
  it("create charge", async () => {
    const prog = app(($) =>
      $.stripe.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });

  it("retrieve charge", async () => {
    const prog = app(($) => $.stripe.charges.retrieve("ch_xxxxxxxxxxxxx"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
  });

  it("list charges", async () => {
    const prog = app(($) => $.stripe.charges.list({ limit: 25 }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// Composition: error + stripe
// ============================================================

describe("composition: error + stripe", () => {
  it("$.attempt wraps successful stripe call", async () => {
    const prog = app(($) => $.attempt($.stripe.customers.create({ email: "attempt@test.com" })));
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + stripe
// ============================================================

describe("composition: fiber + stripe", () => {
  it("$.par runs two stripe calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.stripe.customers.create({ email: "par1@test.com" }),
        $.stripe.customers.create({ email: "par2@test.com" }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("customer");
    expect(result[1].object).toBe("customer");
  });
});

// ============================================================
// Chaining: create customer then create charge with customer ID
// ============================================================

describe("stripe integration: chaining", () => {
  it("create customer then charge with customer id", async () => {
    // stripe-mock is stateless, so the customer ID from create won't
    // actually be looked up. But the AST dependency chain still executes:
    // create customer → extract id → create charge with that customer id.
    const prog = app(($) => {
      const customer = $.stripe.customers.create({ email: "chain@test.com" });
      return $.stripe.charges.create({
        amount: 3000,
        currency: "usd",
        customer: (customer as any).id,
        source: "tok_visa",
      });
    });
    const result = (await run(prog)) as any;
    expect(result.object).toBe("charge");
    expect(result.id).toBeDefined();
  });
});
