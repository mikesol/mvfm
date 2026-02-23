import { describe, expect, it } from "vitest";
import { stripe } from "../../src/2025-04-30.basil";
import { createStripeInterpreter, type StripeClient } from "../../src/2025-04-30.basil/interpreter";

const noopClient: StripeClient = {
  async request() {
    return {};
  },
};

describe("stripe plugin: completeness", () => {
  it("all kinds have matching interpreter handlers", () => {
    const plugin = stripe({ apiKey: "sk_test" });
    const interp = createStripeInterpreter(noopClient);
    for (const kind of Object.keys(plugin.kinds)) {
      expect(interp[kind], `missing handler for ${kind}`).toBeDefined();
    }
  });

  it("all handler kinds appear in plugin kinds", () => {
    const plugin = stripe({ apiKey: "sk_test" });
    const interp = createStripeInterpreter(noopClient);
    for (const kind of Object.keys(interp)) {
      expect(plugin.kinds[kind], `missing kind for ${kind}`).toBeDefined();
    }
  });

  it("all kinds are namespaced with stripe/", () => {
    const plugin = stripe({ apiKey: "sk_test" });
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^stripe\//);
    }
  });

  it("has expected operation count (467 resources + 2 structural)", () => {
    const plugin = stripe({ apiKey: "sk_test" });
    expect(Object.keys(plugin.kinds).length).toBe(469);
  });
});
