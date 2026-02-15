import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { cloudflareKv } from "../../../../src/plugins/cloudflare-kv/4.20260213.0";
import { cloudflareKvInterpreter } from "../../../../src/plugins/cloudflare-kv/4.20260213.0/interpreter";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, cloudflareKv({ namespaceId: "MY_KV" }));
const fragments = [cloudflareKvInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "cloudflare-kv/api_call": async (effect) => {
      captured.push(effect);
      // Return mock values based on operation
      switch (effect.operation) {
        case "get":
          return "mock-text-value";
        case "get_json":
          return { mock: true };
        case "put":
        case "delete":
          return undefined;
        case "list":
          return { keys: [{ name: "key1" }], list_complete: true };
        default:
          return null;
      }
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// get (text — default)
// ============================================================

describe("cloudflare-kv interpreter: get", () => {
  it("yields cloudflare-kv/api_call with operation 'get'", async () => {
    const prog = app(($) => $.kv.get("my-key"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("cloudflare-kv/api_call");
    expect(captured[0].operation).toBe("get");
    expect(captured[0].key).toBe("my-key");
    expect(captured[0].namespaceId).toBe("MY_KV");
  });
});

// ============================================================
// get (json)
// ============================================================

describe("cloudflare-kv interpreter: get with json type", () => {
  it("yields cloudflare-kv/api_call with operation 'get_json'", async () => {
    const prog = app(($) => $.kv.get("config-key", "json"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("cloudflare-kv/api_call");
    expect(captured[0].operation).toBe("get_json");
    expect(captured[0].key).toBe("config-key");
    expect(captured[0].namespaceId).toBe("MY_KV");
  });
});

// ============================================================
// put
// ============================================================

describe("cloudflare-kv interpreter: put", () => {
  it("yields cloudflare-kv/api_call with operation 'put' and key/value", async () => {
    const prog = app(($) => $.kv.put("my-key", "my-value"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("cloudflare-kv/api_call");
    expect(captured[0].operation).toBe("put");
    expect(captured[0].key).toBe("my-key");
    expect(captured[0].value).toBe("my-value");
    expect(captured[0].options).toBeUndefined();
    expect(captured[0].namespaceId).toBe("MY_KV");
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
  it("yields cloudflare-kv/api_call with operation 'delete'", async () => {
    const prog = app(($) => $.kv.delete("old-key"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("cloudflare-kv/api_call");
    expect(captured[0].operation).toBe("delete");
    expect(captured[0].key).toBe("old-key");
    expect(captured[0].namespaceId).toBe("MY_KV");
  });
});

// ============================================================
// list
// ============================================================

describe("cloudflare-kv interpreter: list", () => {
  it("yields cloudflare-kv/api_call with operation 'list' and options", async () => {
    const prog = app(($) => $.kv.list({ prefix: "user:", limit: 100 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("cloudflare-kv/api_call");
    expect(captured[0].operation).toBe("list");
    expect(captured[0].options).toEqual({ prefix: "user:", limit: 100 });
    expect(captured[0].namespaceId).toBe("MY_KV");
  });

  it("omits options when not provided", async () => {
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
  it("resolves input key through recurse", async () => {
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
  it("returns the handler response for get", async () => {
    const prog = app(($) => $.kv.get("key"));
    const { result } = await run(prog);
    expect(result).toBe("mock-text-value");
  });

  it("returns the handler response for get json", async () => {
    const prog = app(($) => $.kv.get("key", "json"));
    const { result } = await run(prog);
    expect(result).toEqual({ mock: true });
  });

  it("returns the handler response for list", async () => {
    const prog = app(($) => $.kv.list());
    const { result } = await run(prog);
    expect(result).toEqual({ keys: [{ name: "key1" }], list_complete: true });
  });
});
