import { describe, expect, it } from "vitest";
import { fal, falPlugin } from "../../src/1.9.1";

const plugin = fal({ credentials: "key_test_123" });
const api = plugin.ctors.fal;

// ---- fal.run ----

describe("fal: run", () => {
  it("produces fal/run CExpr with literal input", () => {
    const expr = api.run("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      method: "post",
      startTimeout: 30,
    });
    expect(expr.__kind).toBe("fal/run");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
    // Options are now passed as-is (Liftable), not wrapped in fal/record
    expect(expr.__args[1]).toEqual({
      input: { prompt: "a cat" },
      method: "post",
      startTimeout: 30,
    });
  });

  it("produces fal/run CExpr with no options", () => {
    const expr = api.run("fal-ai/flux/dev");
    expect(expr.__kind).toBe("fal/run");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
  });
});

// ---- fal.subscribe ----

describe("fal: subscribe", () => {
  it("produces fal/subscribe CExpr", () => {
    const expr = api.subscribe("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      mode: "polling",
      logs: true,
    });
    expect(expr.__kind).toBe("fal/subscribe");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
    // Options are now passed as-is (Liftable), not wrapped in fal/record
    expect(expr.__args[1]).toEqual({
      input: { prompt: "a cat" },
      mode: "polling",
      logs: true,
    });
  });
});

// ---- fal.queue.submit ----

describe("fal: queue.submit", () => {
  it("produces fal/queue_submit CExpr", () => {
    const expr = api.queue.submit("fal-ai/flux/dev", {
      input: { prompt: "a cat" },
      priority: "low",
      hint: "gpu",
    });
    expect(expr.__kind).toBe("fal/queue_submit");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
    // Options are now passed as-is (Liftable), not wrapped in fal/record
    expect(expr.__args[1]).toEqual({
      input: { prompt: "a cat" },
      priority: "low",
      hint: "gpu",
    });
  });
});

// ---- fal.queue.status ----

describe("fal: queue.status", () => {
  it("produces fal/queue_status CExpr with literal requestId", () => {
    const expr = api.queue.status("fal-ai/flux/dev", {
      requestId: "req_123",
      logs: true,
    });
    expect(expr.__kind).toBe("fal/queue_status");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
    // Options are now passed as-is (Liftable), not wrapped in fal/record
    expect(expr.__args[1]).toEqual({
      requestId: "req_123",
      logs: true,
    });
  });
});

// ---- fal.queue.result ----

describe("fal: queue.result", () => {
  it("produces fal/queue_result CExpr", () => {
    const expr = api.queue.result("fal-ai/flux/dev", { requestId: "req_123" });
    expect(expr.__kind).toBe("fal/queue_result");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
  });
});

// ---- fal.queue.cancel ----

describe("fal: queue.cancel", () => {
  it("produces fal/queue_cancel CExpr", () => {
    const expr = api.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" });
    expect(expr.__kind).toBe("fal/queue_cancel");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("fal-ai/flux/dev");
  });
});

// ---- Unified Plugin shape ----

describe("fal plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("fal");
  });

  it("has 6 node kinds", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(6);
  });

  it("has shapes for all 6 kinds", () => {
    expect(Object.keys(plugin.shapes)).toHaveLength(6);
    for (const kind of Object.keys(plugin.shapes)) {
      expect(plugin.shapes[kind]).toEqual([null, "*"]);
    }
  });

  it("kinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^fal\//);
    }
  });

  it("kinds map has entries for all node kinds", () => {
    for (const kind of Object.keys(plugin.kinds)) {
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

// ---- Factory aliases ----

describe("fal plugin: factory aliases", () => {
  it("fal and falPlugin are the same function", () => {
    expect(fal).toBe(falPlugin);
  });
});
