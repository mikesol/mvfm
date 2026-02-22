import { createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cloudflareKv } from "../../src/4.20260213.0";
import type { KVNamespaceLike } from "../../src/4.20260213.0/client-cf-kv";
import { wrapKVNamespace } from "../../src/4.20260213.0/client-cf-kv";
import { createCloudflareKvInterpreter } from "../../src/4.20260213.0/interpreter";

let mf: Miniflare | undefined;
let kvNamespace: KVNamespaceLike | undefined;

const plugin = cloudflareKv({ namespaceId: "MY_KV" });
const plugins = [numPluginU, strPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  if (!kvNamespace) {
    throw new Error("KV namespace is not initialized");
  }
  const client = wrapKVNamespace(kvNamespace);
  const nexpr = app(expr as Parameters<typeof app>[0]);
  const interp = defaults(plugins, {
    "cloudflare-kv": createCloudflareKvInterpreter(client),
  });
  return await fold(nexpr, interp);
}

/** Directly write to KV outside the interpreter (test setup helper). */
async function rawPut(key: string, value: string) {
  if (!kvNamespace) throw new Error("KV namespace is not initialized");
  await kvNamespace.put(key, value);
}

/** Directly read from KV outside the interpreter (test verification helper). */
async function rawGet(key: string) {
  if (!kvNamespace) throw new Error("KV namespace is not initialized");
  return await kvNamespace.get(key);
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    kvNamespaces: ["MY_KV"],
  });
  const kv = await mf.getKVNamespace("MY_KV");
  kvNamespace = kv as unknown as KVNamespaceLike;
}, 30000);

beforeEach(async () => {
  // Clear all keys between tests.
  if (!kvNamespace) return;
  const { keys } = await kvNamespace.list();
  for (const key of keys) {
    await kvNamespace.delete(key.name);
  }
});

afterAll(async () => {
  if (mf) {
    await mf.dispose();
  }
});

// ============================================================
// get (text)
// ============================================================

describe("cloudflare-kv integration: get", () => {
  it("returns null for a missing key", async () => {
    const result = await run($.kv.get("nonexistent"));
    expect(result).toBeNull();
  });

  it("returns the stored text value", async () => {
    await rawPut("greeting", "hello world");
    const result = await run($.kv.get("greeting"));
    expect(result).toBe("hello world");
  });
});

// ============================================================
// get (json)
// ============================================================

describe("cloudflare-kv integration: get json", () => {
  it("returns a parsed JSON object", async () => {
    await rawPut("config", JSON.stringify({ port: 8080, debug: true }));
    const result = await run($.kv.get("config", "json"));
    expect(result).toEqual({ port: 8080, debug: true });
  });

  it("returns null for a missing key", async () => {
    const result = await run($.kv.get("missing", "json"));
    expect(result).toBeNull();
  });
});

// ============================================================
// put
// ============================================================

describe("cloudflare-kv integration: put", () => {
  it("stores a value retrievable via raw get", async () => {
    await run($.kv.put("key1", "value1"));
    expect(await rawGet("key1")).toBe("value1");
  });

  it("overwrites an existing value", async () => {
    await rawPut("key1", "old");
    await run($.kv.put("key1", "new"));
    expect(await rawGet("key1")).toBe("new");
  });

  it("accepts expirationTtl option", async () => {
    await run($.kv.put("ttl-key", "ttl-val", { expirationTtl: 3600 }));
    expect(await rawGet("ttl-key")).toBe("ttl-val");
  });
});

// ============================================================
// put + get roundtrip
// ============================================================

describe("cloudflare-kv integration: put + get roundtrip", () => {
  it("round-trips a text value through the full pipeline", async () => {
    await run($.kv.put("rt-key", "rt-value"));
    const result = await run($.kv.get("rt-key"));
    expect(result).toBe("rt-value");
  });

  it("round-trips a JSON value through the full pipeline", async () => {
    const data = { users: [1, 2, 3], active: true };
    await run($.kv.put("json-rt", JSON.stringify(data)));
    const result = await run($.kv.get("json-rt", "json"));
    expect(result).toEqual(data);
  });
});

// ============================================================
// delete
// ============================================================

describe("cloudflare-kv integration: delete", () => {
  it("removes a key so get returns null", async () => {
    await rawPut("to-delete", "value");
    await run($.kv.delete("to-delete"));
    const result = await run($.kv.get("to-delete"));
    expect(result).toBeNull();
  });

  it("does not error when deleting a non-existent key", async () => {
    await run($.kv.delete("never-existed"));
    // No assertion needed — just verifying it doesn't throw.
  });
});

// ============================================================
// list
// ============================================================

describe("cloudflare-kv integration: list", () => {
  it("lists all keys", async () => {
    await rawPut("a", "1");
    await rawPut("b", "2");
    await rawPut("c", "3");
    const result = (await run($.kv.list())) as {
      keys: Array<{ name: string }>;
      list_complete: boolean;
    };
    expect(result.keys.map((k) => k.name)).toEqual(["a", "b", "c"]);
    expect(result.list_complete).toBe(true);
  });

  it("filters by prefix", async () => {
    await rawPut("user:1", "alice");
    await rawPut("user:2", "bob");
    await rawPut("item:1", "widget");
    const result = (await run($.kv.list({ prefix: "user:" }))) as {
      keys: Array<{ name: string }>;
      list_complete: boolean;
    };
    expect(result.keys.map((k) => k.name)).toEqual(["user:1", "user:2"]);
  });

  it("respects limit and provides cursor for pagination", async () => {
    await rawPut("p1", "1");
    await rawPut("p2", "2");
    await rawPut("p3", "3");
    const page1 = (await run($.kv.list({ limit: 2 }))) as {
      keys: Array<{ name: string }>;
      list_complete: boolean;
      cursor?: string;
    };
    expect(page1.keys).toHaveLength(2);
    expect(page1.list_complete).toBe(false);
    expect(page1.cursor).toBeDefined();
  });

  it("returns empty keys array when no keys match", async () => {
    const result = (await run($.kv.list({ prefix: "zzz:" }))) as {
      keys: Array<{ name: string }>;
      list_complete: boolean;
    };
    expect(result.keys).toEqual([]);
    expect(result.list_complete).toBe(true);
  });
});
