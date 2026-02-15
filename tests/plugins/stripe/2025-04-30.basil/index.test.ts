import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { stripe } from "../../../../src/plugins/stripe/2025-04-30.basil";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, stripe({ apiKey: "sk_test_123" }));

// ============================================================
// Parity tests: Stripe plugin AST builder
// ============================================================

describe("stripe: paymentIntents.create", () => {
  it("produces stripe/create_payment_intent node", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({ amount: 2000, currency: "usd" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.amount.kind).toBe("core/literal");
    expect(ast.result.params.fields.amount.value).toBe(2000);
    expect(ast.result.params.fields.currency.kind).toBe("core/literal");
    expect(ast.result.params.fields.currency.value).toBe("usd");
  });

  it("accepts Expr params and captures proxy dependencies", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.create({
        amount: $.input.amount,
        currency: $.input.currency,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_payment_intent");
    expect(ast.result.params.fields.amount.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.currency.kind).toBe("core/prop_access");
  });
});

describe("stripe: paymentIntents.retrieve", () => {
  it("produces stripe/retrieve_payment_intent node with literal id", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.retrieve("pi_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_payment_intent");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("pi_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.retrieve($.input.paymentIntentId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_payment_intent");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("stripe: paymentIntents.confirm", () => {
  it("produces stripe/confirm_payment_intent node with params", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.confirm("pi_123", { payment_method: "pm_abc" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/confirm_payment_intent");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("pi_123");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.stripe.paymentIntents.confirm("pi_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/confirm_payment_intent");
    expect(ast.result.params).toBeNull();
  });
});

describe("stripe: customers.create", () => {
  it("produces stripe/create_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.create({ email: "test@example.com", name: "Test User" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_customer");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.email.value).toBe("test@example.com");
  });
});

describe("stripe: customers.retrieve", () => {
  it("produces stripe/retrieve_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.retrieve("cus_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_customer");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cus_123");
  });
});

describe("stripe: customers.update", () => {
  it("produces stripe/update_customer node", () => {
    const prog = app(($) => {
      return $.stripe.customers.update("cus_123", { name: "Updated Name" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/update_customer");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cus_123");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.name.value).toBe("Updated Name");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.stripe.customers.update($.input.customerId, {
        name: $.input.newName,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.id.kind).toBe("core/prop_access");
    expect(ast.result.params.fields.name.kind).toBe("core/prop_access");
  });
});

describe("stripe: customers.list", () => {
  it("produces stripe/list_customers node with params", () => {
    const prog = app(($) => {
      return $.stripe.customers.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_customers");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(10);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.stripe.customers.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_customers");
    expect(ast.result.params).toBeNull();
  });
});

describe("stripe: charges.create", () => {
  it("produces stripe/create_charge node", () => {
    const prog = app(($) => {
      return $.stripe.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/create_charge");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("stripe: charges.retrieve", () => {
  it("produces stripe/retrieve_charge node", () => {
    const prog = app(($) => {
      return $.stripe.charges.retrieve("ch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/retrieve_charge");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("ch_123");
  });
});

describe("stripe: charges.list", () => {
  it("produces stripe/list_charges node with params", () => {
    const prog = app(($) => {
      return $.stripe.charges.list({ limit: 25 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_charges");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(25);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.stripe.charges.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("stripe/list_charges");
    expect(ast.result.params).toBeNull();
  });
});

describe("stripe: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const customer = $.stripe.customers.create({ email: "test@example.com" });
        const charge = $.stripe.charges.create({
          amount: 1000,
          currency: "usd",
          customer: customer.id,
        });
        return $.do(customer, charge);
      });
    }).not.toThrow();
  });

  it("orphaned operations are rejected", () => {
    expect(() => {
      app(($) => {
        const customer = $.stripe.customers.retrieve("cus_123");
        $.stripe.charges.create({ amount: 1000, currency: "usd" }); // orphan!
        return customer;
      });
    }).toThrow(/unreachable node/i);
  });
});

describe("stripe: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const customer = $.stripe.customers.create({ email: "test@example.com" });
      const paymentIntent = $.stripe.paymentIntents.create({
        amount: 2000,
        currency: "usd",
        customer: customer.id,
      });
      return $.do(customer, paymentIntent);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
    // The payment intent params should reference the customer via prop_access
    const piParams = ast.result.result.params;
    expect(piParams.fields.customer.kind).toBe("core/prop_access");
  });
});
