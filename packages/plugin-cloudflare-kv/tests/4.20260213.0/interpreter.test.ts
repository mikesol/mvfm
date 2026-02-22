import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { cloudflareKv } from "../../src/4.20260213.0";
import {
  type CloudflareKvClient,
  createCloudflareKvInterpreter,
} from "../../src/4.20260213.0/interpreter";

const plugin = cloudflareKv({ namespaceId: "MY_KV" });
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<Record<string, unknown>> = [];
  const mockClient: CloudflareKvClient = {
    async get(key) {
      captured.push({ operation: "get", key });
      return "mock-text-value";
    },
    async getJson(key) {
      captured.push({ operation: "get_json", key });
      return { mock: true };
    },
    async put(key, value, options) {
      captured.push({ operation: "put", key, value, options });
    },
    async delete(key) {
      captured.push({ operation: "delete", key });
    },
    async list(options) {
      captured.push({ operation: "list", options });
      return { keys: [{ name: "key1" }], list_complete: true };
    },
  };
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    "cloudflare-kv": createCloudflareKvInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// get (text - default)
// ============================================================

describe("cloudflare-kv interpreter: get", () => {
  it("calls client.get with the key", async () => {
    const expr = $.kv.get("my-key");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("get");
    expect(captured[0].key).toBe("my-key");
  });
});

// ============================================================
// get (json)
// ============================================================

describe("cloudflare-kv interpreter: get with json type", () => {
  it("calls client.getJson with the key", async () => {
    const expr = $.kv.get("config-key", "json");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("get_json");
    expect(captured[0].key).toBe("config-key");
  });
});

// ============================================================
// put
// ============================================================

describe("cloudflare-kv interpreter: put", () => {
  it("calls client.put with key and value", async () => {
    const expr = $.kv.put("my-key", "my-value");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("put");
    expect(captured[0].key).toBe("my-key");
    expect(captured[0].value).toBe("my-value");
    expect(captured[0].options).toBeUndefined();
  });

  it("includes options when provided", async () => {
    const expr = $.kv.put("key", "val", { expirationTtl: 3600 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].options).toEqual({ expirationTtl: 3600 });
  });
});

// ============================================================
// delete
// ============================================================

describe("cloudflare-kv interpreter: delete", () => {
  it("calls client.delete with the key", async () => {
    const expr = $.kv.delete("old-key");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("delete");
    expect(captured[0].key).toBe("old-key");
  });
});

// ============================================================
// list
// ============================================================

describe("cloudflare-kv interpreter: list", () => {
  it("calls client.list with options", async () => {
    const expr = $.kv.list({ prefix: "user:", limit: 100 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("list");
    expect(captured[0].options).toEqual({ prefix: "user:", limit: 100 });
  });

  it("calls client.list with undefined options when not provided", async () => {
    const expr = $.kv.list();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("list");
    expect(captured[0].options).toBeUndefined();
  });
});

// ============================================================
// return values
// ============================================================

describe("cloudflare-kv interpreter: return value", () => {
  it("returns the client response for get", async () => {
    const expr = $.kv.get("key");
    const { result } = await run(expr);
    expect(result).toBe("mock-text-value");
  });

  it("returns the client response for get json", async () => {
    const expr = $.kv.get("key", "json");
    const { result } = await run(expr);
    expect(result).toEqual({ mock: true });
  });

  it("returns the client response for list", async () => {
    const expr = $.kv.list();
    const { result } = await run(expr);
    expect(result).toEqual({ keys: [{ name: "key1" }], list_complete: true });
  });
});

// ============================================================
// defaults() throws without override
// ============================================================

describe("cloudflare-kv interpreter: defaults() without override", () => {
  it("throws when no override provided for cloudflare-kv plugin", () => {
    expect(() => defaults(plugins)).toThrow(/no defaultInterpreter/i);
  });
});
