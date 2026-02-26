import { describe, expect, it } from "vitest";
import { fetch, fetchPlugin } from "../../src/whatwg";

const plugin = fetchPlugin;
const api = plugin.ctors.fetch;

// ============================================================
// CExpr construction — fetch/request
// ============================================================

describe("fetch plugin: CExpr construction", () => {
  it("$.fetch(url) emits CExpr with fetch/request kind", () => {
    const expr = api("https://api.example.com/data");
    expect(expr.__kind).toBe("fetch/request");
    expect(expr.__args).toHaveLength(1);
  });

  it("$.fetch(url, init) emits CExpr with fetch/request kind and two args", () => {
    const expr = api("https://api.example.com/data", { method: "POST" });
    expect(expr.__kind).toBe("fetch/request");
    expect(expr.__args).toHaveLength(2);
  });

  it("$.fetch.json(response) emits CExpr with fetch/json kind", () => {
    const resp = api("https://api.example.com/data");
    const expr = api.json(resp);
    expect(expr.__kind).toBe("fetch/json");
    expect(expr.__args).toHaveLength(1);
  });

  it("$.fetch.text(response) emits CExpr with fetch/text kind", () => {
    const resp = api("https://api.example.com/data");
    const expr = api.text(resp);
    expect(expr.__kind).toBe("fetch/text");
    expect(expr.__args).toHaveLength(1);
  });

  it("$.fetch.status(response) emits CExpr with fetch/status kind", () => {
    const resp = api("https://api.example.com/data");
    const expr = api.status(resp);
    expect(expr.__kind).toBe("fetch/status");
    expect(expr.__args).toHaveLength(1);
  });

  it("$.fetch.headers(response) emits CExpr with fetch/headers kind", () => {
    const resp = api("https://api.example.com/data");
    const expr = api.headers(resp);
    expect(expr.__kind).toBe("fetch/headers");
    expect(expr.__args).toHaveLength(1);
  });
});

// ============================================================
// Unified Plugin shape
// ============================================================

describe("fetch plugin: unified Plugin shape", () => {
  it("has correct name", () => {
    expect(plugin.name).toBe("fetch");
  });

  it("has 5 node kinds (record + array removed, handled by shapes)", () => {
    expect(Object.keys(plugin.kinds)).toHaveLength(5);
  });

  it("kinds are all namespaced", () => {
    for (const kind of Object.keys(plugin.kinds)) {
      expect(kind).toMatch(/^fetch\//);
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
    const interp = plugin.defaultInterpreter();
    for (const kind of Object.keys(plugin.kinds)) {
      expect(typeof interp[kind]).toBe("function");
    }
  });
});

// ============================================================
// fetch and fetchPlugin are the same
// ============================================================

describe("fetch plugin: factory aliases", () => {
  it("fetch and fetchPlugin are the same function", () => {
    expect(fetch).toBe(fetchPlugin);
  });
});
