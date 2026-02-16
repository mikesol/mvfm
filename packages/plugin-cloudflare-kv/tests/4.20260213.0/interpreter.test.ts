import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { cloudflareKv } from "../../src/4.20260213.0";
import {
  type CloudflareKvClient,
  createCloudflareKvInterpreter,
} from "../../src/4.20260213.0/interpreter";

const app = mvfm(num, str, cloudflareKv({ namespaceId: "MY_KV" }));

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
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
  const injected = injectInput(prog, input);
  const combined = { ...createCloudflareKvInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
  return { result, captured };
}

// ============================================================
// get (text - default)
// ============================================================

describe("cloudflare-kv interpreter: get", () => {
  it("calls client.get with the key", async () => {
    const prog = app(($) => $.kv.get("my-key"));
    const { captured } = await run(prog);
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
    const prog = app(($) => $.kv.get("config-key", "json"));
    const { captured } = await run(prog);
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
    const prog = app(($) => $.kv.put("my-key", "my-value"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("put");
    expect(captured[0].key).toBe("my-key");
    expect(captured[0].value).toBe("my-value");
    expect(captured[0].options).toBeUndefined();
  });

  it("includes options when provided", async () => {
    const prog = app(($) => $.kv.put("key", "val", { expirationTtl: 3600 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].options).toEqual({ expirationTtl: 3600 });
  });
});

// ============================================================
// delete
// ============================================================

describe("cloudflare-kv interpreter: delete", () => {
  it("calls client.delete with the key", async () => {
    const prog = app(($) => $.kv.delete("old-key"));
    const { captured } = await run(prog);
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
    const prog = app(($) => $.kv.list({ prefix: "user:", limit: 100 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("list");
    expect(captured[0].options).toEqual({ prefix: "user:", limit: 100 });
  });

  it("calls client.list with undefined options when not provided", async () => {
    const prog = app(($) => $.kv.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe("list");
    expect(captured[0].options).toBeUndefined();
  });
});

// ============================================================
// input resolution
// ============================================================

describe("cloudflare-kv interpreter: input resolution", () => {
  it("resolves input key through evaluation", async () => {
    const prog = app({ cacheKey: "string" }, ($) => $.kv.get($.input.cacheKey));
    const { captured } = await run(prog, { cacheKey: "dynamic-key" });
    expect(captured).toHaveLength(1);
    expect(captured[0].key).toBe("dynamic-key");
  });

  it("resolves input key and value for put", async () => {
    const prog = app({ key: "string", val: "string" }, ($) => $.kv.put($.input.key, $.input.val));
    const { captured } = await run(prog, { key: "k", val: "v" });
    expect(captured).toHaveLength(1);
    expect(captured[0].key).toBe("k");
    expect(captured[0].value).toBe("v");
  });
});

// ============================================================
// return values
// ============================================================

describe("cloudflare-kv interpreter: return value", () => {
  it("returns the client response for get", async () => {
    const prog = app(($) => $.kv.get("key"));
    const { result } = await run(prog);
    expect(result).toBe("mock-text-value");
  });

  it("returns the client response for get json", async () => {
    const prog = app(($) => $.kv.get("key", "json"));
    const { result } = await run(prog);
    expect(result).toEqual({ mock: true });
  });

  it("returns the client response for list", async () => {
    const prog = app(($) => $.kv.list());
    const { result } = await run(prog);
    expect(result).toEqual({ keys: [{ name: "key1" }], list_complete: true });
  });
});
