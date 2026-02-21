import { describe, expect, it } from "vitest";
import { stripe, stripePlugin } from "../../src/2025-04-30.basil";

const plugin = stripe({ apiKey: "sk_test_123" });
const api = plugin.ctors.stripe;

// ============================================================
// CExpr construction tests
// ============================================================

describe("stripe: paymentIntents.create", () => {
  it("produces stripe/create_payment_intent CExpr", () => {
    const expr = api.paymentIntents.create({ amount: 2000, currency: "usd" });
    expect(expr.__kind).toBe("stripe/create_payment_intent");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });
});

describe("stripe: paymentIntents.retrieve", () => {
  it("produces stripe/retrieve_payment_intent CExpr with string id", () => {
    const expr = api.paymentIntents.retrieve("pi_123");
    expect(expr.__kind).toBe("stripe/retrieve_payment_intent");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("pi_123");
  });

  it("accepts CExpr id (proxy chained value)", () => {
    const pi = api.paymentIntents.retrieve("pi_123");
    const expr = api.paymentIntents.retrieve(pi.id);
    expect(expr.__kind).toBe("stripe/retrieve_payment_intent");
    expect(expr.__args).toHaveLength(1);
    const idArg = expr.__args[0] as { __kind: string };
    expect(idArg.__kind).toBe("core/access");
  });
});

describe("stripe: paymentIntents.confirm", () => {
  it("produces stripe/confirm_payment_intent CExpr with params", () => {
    const expr = api.paymentIntents.confirm("pi_123", { payment_method: "pm_abc" });
    expect(expr.__kind).toBe("stripe/confirm_payment_intent");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("pi_123");
    const paramsArg = expr.__args[1] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });

  it("produces CExpr with 1 arg when params omitted", () => {
    const expr = api.paymentIntents.confirm("pi_123");
    expect(expr.__kind).toBe("stripe/confirm_payment_intent");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("pi_123");
  });
});

describe("stripe: customers.create", () => {
  it("produces stripe/create_customer CExpr", () => {
    const expr = api.customers.create({ email: "test@example.com" });
    expect(expr.__kind).toBe("stripe/create_customer");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });
});

describe("stripe: customers.retrieve", () => {
  it("produces stripe/retrieve_customer CExpr", () => {
    const expr = api.customers.retrieve("cus_123");
    expect(expr.__kind).toBe("stripe/retrieve_customer");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("cus_123");
  });
});

describe("stripe: customers.update", () => {
  it("produces stripe/update_customer CExpr", () => {
    const expr = api.customers.update("cus_123", { name: "Updated Name" });
    expect(expr.__kind).toBe("stripe/update_customer");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("cus_123");
    const paramsArg = expr.__args[1] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });
});

describe("stripe: customers.list", () => {
  it("produces stripe/list_customers CExpr with params", () => {
    const expr = api.customers.list({ limit: 10 });
    expect(expr.__kind).toBe("stripe/list_customers");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.customers.list();
    expect(expr.__kind).toBe("stripe/list_customers");
    expect(expr.__args).toHaveLength(0);
  });
});

describe("stripe: charges.create", () => {
  it("produces stripe/create_charge CExpr", () => {
    const expr = api.charges.create({ amount: 5000, currency: "usd", source: "tok_visa" });
    expect(expr.__kind).toBe("stripe/create_charge");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });
});

describe("stripe: charges.retrieve", () => {
  it("produces stripe/retrieve_charge CExpr", () => {
    const expr = api.charges.retrieve("ch_123");
    expect(expr.__kind).toBe("stripe/retrieve_charge");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("ch_123");
  });
});

describe("stripe: charges.list", () => {
  it("produces stripe/list_charges CExpr with params", () => {
    const expr = api.charges.list({ limit: 25 });
    expect(expr.__kind).toBe("stripe/list_charges");
    expect(expr.__args).toHaveLength(1);
    const paramsArg = expr.__args[0] as { __kind: string };
    expect(paramsArg.__kind).toBe("stripe/record");
  });

  it("produces CExpr with no args when omitted", () => {
    const expr = api.charges.list();
    expect(expr.__kind).toBe("stripe/list_charges");
    expect(expr.__args).toHaveLength(0);
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("stripe plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("stripe");
  });

  it("has 12 node kinds (10 core + record + array)", () => {
    expect(plugin.nodeKinds).toHaveLength(12);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^stripe\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of plugin.nodeKinds) {
      expect(plugin.kinds[kind]).toBeDefined();
    }
  });

  it("has empty traits and lifts", () => {
    expect(plugin.traits).toEqual({});
    expect(plugin.lifts).toEqual({});
  });

  it("has a defaultInterpreter factory", () => {
    expect(typeof plugin.defaultInterpreter).toBe("function");
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("stripe plugin: factory aliases", () => {
  it("stripe and stripePlugin are the same function", () => {
    expect(stripe).toBe(stripePlugin);
  });
});
