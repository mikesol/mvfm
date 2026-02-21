import { describe, expect, it } from "vitest";
import { cloudflareKv, cloudflareKvPlugin } from "../../src/4.20260213.0";

const plugin = cloudflareKv({ namespaceId: "MY_KV" });
const api = plugin.ctors.kv;

// ============================================================
// CExpr construction tests
// ============================================================

describe("cloudflare-kv: get", () => {
  it("produces cloudflare-kv/get CExpr with literal key", () => {
    const expr = api.get("my-key");
    expect(expr.__kind).toBe("cloudflare-kv/get");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("my-key");
  });

  it("produces cloudflare-kv/get CExpr with explicit 'text' type", () => {
    const expr = api.get("my-key", "text");
    expect(expr.__kind).toBe("cloudflare-kv/get");
    expect(expr.__args).toHaveLength(1);
  });

  it("accepts CExpr key (proxy chained value)", () => {
    const listResult = api.list();
    const expr = api.get(listResult.keys[0].name);
    expect(expr.__kind).toBe("cloudflare-kv/get");
    expect(expr.__args).toHaveLength(1);
  });
});

describe("cloudflare-kv: get with json type", () => {
  it("produces cloudflare-kv/get_json CExpr with literal key", () => {
    const expr = api.get("config-key", "json");
    expect(expr.__kind).toBe("cloudflare-kv/get_json");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("config-key");
  });
});

describe("cloudflare-kv: put", () => {
  it("produces cloudflare-kv/put CExpr with key and value", () => {
    const expr = api.put("my-key", "my-value");
    expect(expr.__kind).toBe("cloudflare-kv/put");
    expect(expr.__args).toHaveLength(2);
    expect(expr.__args[0]).toBe("my-key");
    expect(expr.__args[1]).toBe("my-value");
  });

  it("produces cloudflare-kv/put CExpr with options", () => {
    const expr = api.put("key", "val", { expirationTtl: 3600 });
    expect(expr.__kind).toBe("cloudflare-kv/put");
    expect(expr.__args).toHaveLength(3);
    const optionsArg = expr.__args[2] as { __kind: string };
    expect(optionsArg.__kind).toBe("cloudflare-kv/record");
  });
});

describe("cloudflare-kv: delete", () => {
  it("produces cloudflare-kv/delete CExpr with literal key", () => {
    const expr = api.delete("old-key");
    expect(expr.__kind).toBe("cloudflare-kv/delete");
    expect(expr.__args).toHaveLength(1);
    expect(expr.__args[0]).toBe("old-key");
  });
});

describe("cloudflare-kv: list", () => {
  it("produces cloudflare-kv/list CExpr with options", () => {
    const expr = api.list({ prefix: "user:", limit: 100 });
    expect(expr.__kind).toBe("cloudflare-kv/list");
    expect(expr.__args).toHaveLength(1);
    const optionsArg = expr.__args[0] as { __kind: string };
    expect(optionsArg.__kind).toBe("cloudflare-kv/record");
  });

  it("produces cloudflare-kv/list CExpr with no children when options omitted", () => {
    const expr = api.list();
    expect(expr.__kind).toBe("cloudflare-kv/list");
    expect(expr.__args).toHaveLength(0);
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("cloudflare-kv plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("cloudflare-kv");
  });

  it("has 7 node kinds (5 core + record + array)", () => {
    expect(plugin.nodeKinds).toHaveLength(7);
  });

  it("nodeKinds are all namespaced", () => {
    for (const kind of plugin.nodeKinds) {
      expect(kind).toMatch(/^cloudflare-kv\//);
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

  it("has NO defaultInterpreter", () => {
    expect(plugin.defaultInterpreter).toBeUndefined();
  });
});

// ============================================================
// Factory aliases
// ============================================================

describe("cloudflare-kv plugin: factory aliases", () => {
  it("cloudflareKv and cloudflareKvPlugin are the same function", () => {
    expect(cloudflareKv).toBe(cloudflareKvPlugin);
  });
});
