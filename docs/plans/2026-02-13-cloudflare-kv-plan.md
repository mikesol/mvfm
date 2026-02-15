# Cloudflare KV Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `cloudflare-kv` plugin (#57) modeling Cloudflare Workers KV with get, getJson, put, delete, and list operations.

**Architecture:** External-service plugin following the stripe pattern. Factory function `cloudflareKv(config)` returns a `PluginDefinition<CloudflareKvMethods>`. Five node kinds, one unified effect type (`cloudflare-kv/api_call`), generator-based interpreter, server/client handlers, and a thin SDK adapter wrapping the real `KVNamespace`.

**Tech Stack:** TypeScript, vitest for tests, `@cloudflare/workers-types` for the `KVNamespace` type definition.

---

### Task 1: Create directory structure and plugin definition (index.ts)

**Files:**
- Create: `src/plugins/cloudflare-kv/4.20260213.0/index.ts`

**Step 1: Create the directory**

Run: `mkdir -p src/plugins/cloudflare-kv/4.20260213.0`

**Step 2: Write index.ts**

```ts
// ============================================================
// ILO PLUGIN: cloudflare-kv (@cloudflare/workers-types KVNamespace)
// ============================================================
//
// Implementation status: COMPLETE (modulo known limitations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Known limitations (deliberate omissions):
//   - No arrayBuffer/stream return types (binary/streaming)
//   - No batch get (multi-key fetch)
//   - No getWithMetadata (deferred to pass 2)
//   - No cacheTtl option on get
//
// Goal: An LLM that knows the Cloudflare Workers KV API should
// be able to write Ilo programs with near-zero learning curve.
//
// Real KVNamespace API (@cloudflare/workers-types 4.20260213.0):
//   const value = await KV.get("key")
//   const json = await KV.get("key", "json")
//   await KV.put("key", "value", { expirationTtl: 3600 })
//   await KV.delete("key")
//   const list = await KV.list({ prefix: "user:" })
//
// Ilo API:
//   const value = $.kv.get("key")
//   const json = $.kv.getJson("key")
//   $.kv.put("key", "value", { expirationTtl: 3600 })
//   $.kv.delete("key")
//   const list = $.kv.list({ prefix: "user:" })
//
// Deviation #1: getJson is a separate method instead of
//   get(key, "json"). This gives each operation a distinct
//   node kind which is cleaner for the interpreter.
//
// Based on source-level analysis of @cloudflare/workers-types
// v4.20260213.0 — the KVNamespace interface (latest/index.ts
// lines 2159-2272).
//
// ============================================================

import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Cloudflare KV operations added to the DSL context.
 *
 * Mirrors the KVNamespace API: get, getJson, put, delete, list.
 * Each method produces a namespaced AST node.
 */
export interface CloudflareKvMethods {
  /** Cloudflare KV operations, namespaced under `$.kv`. */
  kv: {
    /** Get a text value by key. Returns null if key does not exist. */
    get(key: Expr<string> | string): Expr<string | null>;
    /** Get a JSON-parsed value by key. Returns null if key does not exist. */
    getJson<T = unknown>(key: Expr<string> | string): Expr<T | null>;
    /** Store a string value at key with optional expiration settings. */
    put(
      key: Expr<string> | string,
      value: Expr<string> | string,
      options?: Expr<KvPutOptions> | KvPutOptions,
    ): Expr<void>;
    /** Delete a key. */
    delete(key: Expr<string> | string): Expr<void>;
    /** List keys with optional prefix filter and pagination cursor. */
    list(options?: Expr<KvListOptions> | KvListOptions): Expr<KvListResult>;
  };
}

// ---- Supporting types -------------------------------------

/** Options for `kv.put()`. */
export interface KvPutOptions {
  /** Unix timestamp (seconds) when the key should expire. */
  expiration?: number;
  /** TTL in seconds from now until the key expires. */
  expirationTtl?: number;
  /** Arbitrary metadata to attach to the key. */
  metadata?: unknown;
}

/** Options for `kv.list()`. */
export interface KvListOptions {
  /** Maximum number of keys to return. */
  limit?: number;
  /** Only return keys starting with this prefix. */
  prefix?: string;
  /** Cursor for pagination from a previous list result. */
  cursor?: string;
}

/** Result of `kv.list()`. */
export interface KvListResult {
  /** The matching keys. */
  keys: Array<{ name: string; expiration?: number }>;
  /** Whether all matching keys have been returned. */
  list_complete: boolean;
  /** Cursor for fetching the next page (only present when list_complete is false). */
  cursor?: string;
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the cloudflare-kv plugin.
 *
 * Identifies which KV namespace to operate against.
 */
export interface CloudflareKvConfig {
  /** The KV namespace binding name (e.g., "MY_KV"). */
  namespaceId: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Cloudflare KV plugin factory. Namespace: `cloudflare-kv/`.
 *
 * Creates a plugin that exposes get, getJson, put, delete, and list
 * methods for building Cloudflare KV AST nodes.
 *
 * @param config - A {@link CloudflareKvConfig} with namespaceId.
 * @returns A {@link PluginDefinition} for the cloudflare-kv plugin.
 */
export function cloudflareKv(
  config: CloudflareKvConfig,
): PluginDefinition<CloudflareKvMethods> {
  return {
    name: "cloudflare-kv",
    nodeKinds: [
      "cloudflare-kv/get",
      "cloudflare-kv/get_json",
      "cloudflare-kv/put",
      "cloudflare-kv/delete",
      "cloudflare-kv/list",
    ],

    build(ctx: PluginContext): CloudflareKvMethods {
      function resolveKey(key: Expr<string> | string): ASTNode {
        return ctx.isExpr(key) ? key.__node : ctx.lift(key).__node;
      }

      return {
        kv: {
          get(key) {
            return ctx.expr({
              kind: "cloudflare-kv/get",
              key: resolveKey(key),
              config,
            });
          },

          getJson(key) {
            return ctx.expr({
              kind: "cloudflare-kv/get_json",
              key: resolveKey(key),
              config,
            });
          },

          put(key, value, options?) {
            return ctx.expr({
              kind: "cloudflare-kv/put",
              key: resolveKey(key),
              value: ctx.isExpr(value)
                ? value.__node
                : ctx.lift(value).__node,
              options:
                options != null ? ctx.lift(options).__node : null,
              config,
            });
          },

          delete(key) {
            return ctx.expr({
              kind: "cloudflare-kv/delete",
              key: resolveKey(key),
              config,
            });
          },

          list(options?) {
            return ctx.expr({
              kind: "cloudflare-kv/list",
              options:
                options != null ? ctx.lift(options).__node : null,
              config,
            });
          },
        },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic get/put/delete:
//    Real:  const val = await KV.get("key")
//    Ilo:   const val = $.kv.get("key")
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. JSON values:
//    Real:  const data = await KV.get("key", "json")
//    Ilo:   const data = $.kv.getJson("key")
//    Separate method name but same semantics.
//
// 3. Put with expiration:
//    Real:  await KV.put("key", "val", { expirationTtl: 3600 })
//    Ilo:   $.kv.put("key", "val", { expirationTtl: 3600 })
//    1:1 mapping.
//
// 4. List with prefix/cursor:
//    Real:  const result = await KV.list({ prefix: "user:" })
//    Ilo:   const result = $.kv.list({ prefix: "user:" })
//    1:1 mapping. Pagination via cursor works naturally.
//
// 5. Parameterized keys:
//    const val = $.kv.get($.input.cacheKey)
//    Proxy chains capture key dependencies perfectly.
//
// WORKS BUT DIFFERENT:
//
// 6. get type parameter:
//    Real:  KV.get("key", "json") / KV.get("key", "text")
//    Ilo:   $.kv.getJson("key") / $.kv.get("key")
//    Split into separate methods for cleaner AST node kinds.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Binary/streaming:
//    Real:  KV.get("key", "arrayBuffer") / KV.get("key", "stream")
//    Ilo:   Not modeled. Binary data and streams don't fit a
//           finite, inspectable AST.
//
// 8. getWithMetadata:
//    Real:  KV.getWithMetadata("key")
//    Ilo:   Not yet modeled. Returns {value, metadata, cacheStatus}.
//           Could be added as cloudflare-kv/get_with_metadata.
//
// 9. Batch get:
//    Real:  KV.get(["key1", "key2"])
//    Ilo:   Not yet modeled. Multi-key fetch returns a Map.
//           Could be added as cloudflare-kv/get_batch.
//
// 10. Metadata on put:
//    Real:  KV.put("key", "val", { metadata: { foo: "bar" } })
//    Ilo:   Partially modeled — the options type includes metadata
//           but the handler ignores it for now.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of @cloudflare/workers-types
// v4.20260213.0 (KVNamespace interface, latest/index.ts).
//
// For the core use case of "store and retrieve string/JSON
// values by key with optional expiration" — this is nearly
// identical to the real KVNamespace API. List with prefix
// filtering and cursor pagination maps 1:1.
//
// The main deviation is getJson as a separate method instead
// of get(key, "json"). This is cleaner for the AST.
//
// Not supported: binary data (arrayBuffer), streaming,
// getWithMetadata, batch get. These could be added
// incrementally in future passes.
// ============================================================
```

**Step 3: Commit**

```bash
git add src/plugins/cloudflare-kv/4.20260213.0/index.ts
git commit -m "feat(cloudflare-kv): add plugin definition with get, getJson, put, delete, list (#57)"
```

---

### Task 2: Write AST construction tests (index.test.ts)

**Files:**
- Create: `tests/plugins/cloudflare-kv/4.20260213.0/index.test.ts`

**Step 1: Create test directory**

Run: `mkdir -p tests/plugins/cloudflare-kv/4.20260213.0`

**Step 2: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { cloudflareKv } from "../../../../src/plugins/cloudflare-kv/4.20260213.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, cloudflareKv({ namespaceId: "MY_KV" }));

// ============================================================
// get
// ============================================================

describe("cloudflare-kv: get", () => {
  it("produces cloudflare-kv/get node with literal key", () => {
    const prog = app(($) => {
      return $.kv.get("my-key");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("my-key");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => {
      return $.kv.get($.input.cacheKey);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// getJson
// ============================================================

describe("cloudflare-kv: getJson", () => {
  it("produces cloudflare-kv/get_json node with literal key", () => {
    const prog = app(($) => {
      return $.kv.getJson("config-key");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get_json");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("config-key");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => {
      return $.kv.getJson($.input.configKey);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/get_json");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// put
// ============================================================

describe("cloudflare-kv: put", () => {
  it("produces cloudflare-kv/put node with key and value", () => {
    const prog = app(($) => {
      return $.kv.put("my-key", "my-value");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/put");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("my-key");
    expect(ast.result.value.kind).toBe("core/literal");
    expect(ast.result.value.value).toBe("my-value");
    expect(ast.result.options).toBeNull();
  });

  it("accepts options with expirationTtl", () => {
    const prog = app(($) => {
      return $.kv.put("key", "val", { expirationTtl: 3600 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/put");
    expect(ast.result.options.kind).toBe("core/record");
    expect(ast.result.options.fields.expirationTtl.kind).toBe("core/literal");
    expect(ast.result.options.fields.expirationTtl.value).toBe(3600);
  });

  it("accepts Expr key and value", () => {
    const prog = app(($) => {
      return $.kv.put($.input.key, $.input.value);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.key.kind).toBe("core/prop_access");
    expect(ast.result.value.kind).toBe("core/prop_access");
  });
});

// ============================================================
// delete
// ============================================================

describe("cloudflare-kv: delete", () => {
  it("produces cloudflare-kv/delete node with literal key", () => {
    const prog = app(($) => {
      return $.kv.delete("old-key");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/delete");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("old-key");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => {
      return $.kv.delete($.input.keyToDelete);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/delete");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

// ============================================================
// list
// ============================================================

describe("cloudflare-kv: list", () => {
  it("produces cloudflare-kv/list node with options", () => {
    const prog = app(($) => {
      return $.kv.list({ prefix: "user:", limit: 100 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/list");
    expect(ast.result.options.kind).toBe("core/record");
    expect(ast.result.options.fields.prefix.value).toBe("user:");
    expect(ast.result.options.fields.limit.value).toBe(100);
  });

  it("optional options are null when omitted", () => {
    const prog = app(($) => {
      return $.kv.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("cloudflare-kv/list");
    expect(ast.result.options).toBeNull();
  });
});

// ============================================================
// cross-operation dependencies
// ============================================================

describe("cloudflare-kv: cross-operation dependencies", () => {
  it("can use result of get as input to put", () => {
    const prog = app(($) => {
      const cached = $.kv.get("source-key");
      const stored = $.kv.put("dest-key", cached);
      return $.do(cached, stored);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
```

**Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/cloudflare-kv/4.20260213.0/index.test.ts`
Expected: All tests PASS (the plugin definition from Task 1 should satisfy all AST construction tests)

**Step 4: Commit**

```bash
git add tests/plugins/cloudflare-kv/4.20260213.0/index.test.ts
git commit -m "test(cloudflare-kv): add AST construction tests (#57)"
```

---

### Task 3: Write the interpreter (interpreter.ts)

**Files:**
- Create: `src/plugins/cloudflare-kv/4.20260213.0/interpreter.ts`

**Step 1: Write the interpreter**

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Cloudflare KV client interface consumed by the handler.
 *
 * Abstracts over the actual KVNamespace binding so handlers
 * can be tested with mock clients.
 */
export interface CloudflareKvClient {
  /** Get a text value by key. */
  get(key: string): Promise<string | null>;
  /** Get a JSON-parsed value by key. */
  getJson<T = unknown>(key: string): Promise<T | null>;
  /** Store a string value at key with optional options. */
  put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }): Promise<void>;
  /** Delete a key. */
  delete(key: string): Promise<void>;
  /** List keys with optional filtering/pagination. */
  list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Generator-based interpreter fragment for cloudflare-kv plugin nodes.
 *
 * Yields `cloudflare-kv/api_call` effects for all 5 operations.
 * Each effect contains the operation name, parameters, and namespace ID.
 */
export const cloudflareKvInterpreter: InterpreterFragment = {
  pluginName: "cloudflare-kv",
  canHandle: (node) => node.kind.startsWith("cloudflare-kv/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const config = node.config as { namespaceId: string };

    switch (node.kind) {
      case "cloudflare-kv/get": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "get",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/get_json": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "get_json",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/put": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "put",
          key,
          value,
          ...(options !== undefined ? { options } : {}),
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/delete": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "delete",
          key,
          namespaceId: config.namespaceId,
        };
      }

      case "cloudflare-kv/list": {
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "cloudflare-kv/api_call",
          operation: "list",
          ...(options !== undefined ? { options } : {}),
          namespaceId: config.namespaceId,
        };
      }

      default:
        throw new Error(`Cloudflare KV interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 2: Commit**

```bash
git add src/plugins/cloudflare-kv/4.20260213.0/interpreter.ts
git commit -m "feat(cloudflare-kv): add interpreter fragment (#57)"
```

---

### Task 4: Write interpreter tests (interpreter.test.ts)

**Files:**
- Create: `tests/plugins/cloudflare-kv/4.20260213.0/interpreter.test.ts`

**Step 1: Write the interpreter tests**

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { cloudflareKv } from "../../../../src/plugins/cloudflare-kv/4.20260213.0";
import { cloudflareKvInterpreter } from "../../../../src/plugins/cloudflare-kv/4.20260213.0/interpreter";

const app = ilo(num, str, cloudflareKv({ namespaceId: "MY_KV" }));
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
// get
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
// getJson
// ============================================================

describe("cloudflare-kv interpreter: getJson", () => {
  it("yields cloudflare-kv/api_call with operation 'get_json'", async () => {
    const prog = app(($) => $.kv.getJson("config-key"));
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
    const prog = app({ key: "string", val: "string" }, ($) =>
      $.kv.put($.input.key, $.input.val),
    );
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

  it("returns the handler response for getJson", async () => {
    const prog = app(($) => $.kv.getJson("key"));
    const { result } = await run(prog);
    expect(result).toEqual({ mock: true });
  });

  it("returns the handler response for list", async () => {
    const prog = app(($) => $.kv.list());
    const { result } = await run(prog);
    expect(result).toEqual({ keys: [{ name: "key1" }], list_complete: true });
  });
});
```

**Step 2: Run the interpreter tests**

Run: `npx vitest run tests/plugins/cloudflare-kv/4.20260213.0/interpreter.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/plugins/cloudflare-kv/4.20260213.0/interpreter.test.ts
git commit -m "test(cloudflare-kv): add interpreter tests (#57)"
```

---

### Task 5: Write server handler (handler.server.ts)

**Files:**
- Create: `src/plugins/cloudflare-kv/4.20260213.0/handler.server.ts`

**Step 1: Write the server handler**

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { CloudflareKvClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Cloudflare KV
 * effects against a real KV client.
 *
 * Handles `cloudflare-kv/api_call` effects by delegating to the
 * appropriate client method based on the operation field.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: CloudflareKvClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "cloudflare-kv/api_call") {
      const { operation, key, value: val, options, namespaceId } = effect as {
        type: "cloudflare-kv/api_call";
        operation: string;
        key?: string;
        value?: string;
        options?: Record<string, unknown>;
        namespaceId: string;
      };

      let result: unknown;

      switch (operation) {
        case "get":
          result = await client.get(key as string);
          break;
        case "get_json":
          result = await client.getJson(key as string);
          break;
        case "put":
          result = await client.put(key as string, val as string, options);
          break;
        case "delete":
          result = await client.delete(key as string);
          break;
        case "list":
          result = await client.list(options);
          break;
        default:
          throw new Error(`serverHandler: unknown KV operation "${operation}"`);
      }

      return { value: result, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Cloudflare KV client using the provided interpreter fragments.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: CloudflareKvClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/cloudflare-kv/4.20260213.0/handler.server.ts
git commit -m "feat(cloudflare-kv): add server handler (#57)"
```

---

### Task 6: Write client handler (handler.client.ts)

**Files:**
- Create: `src/plugins/cloudflare-kv/4.20260213.0/handler.client.ts`

**Step 1: Write the client handler**

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends Cloudflare KV
 * effects as JSON to a remote server endpoint for execution.
 *
 * Each effect is sent as a POST request to `{baseUrl}/ilo/execute` with
 * the contract hash, step index, path, and effect payload.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/cloudflare-kv/4.20260213.0/handler.client.ts
git commit -m "feat(cloudflare-kv): add client handler (#57)"
```

---

### Task 7: Write SDK adapter (client-cf-kv.ts)

**Files:**
- Create: `src/plugins/cloudflare-kv/4.20260213.0/client-cf-kv.ts`

**Step 1: Write the SDK adapter**

```ts
import type { CloudflareKvClient } from "./interpreter";

/**
 * KVNamespace-compatible interface.
 *
 * Matches the subset of the `KVNamespace` type from
 * `@cloudflare/workers-types` that this plugin uses.
 * Avoids a direct dependency on the types package.
 */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  get(key: string, type: "text"): Promise<string | null>;
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    limit?: number;
    prefix?: string | null;
    cursor?: string | null;
  }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Wraps a Cloudflare Workers KVNamespace binding into a
 * {@link CloudflareKvClient}.
 *
 * @param kv - A KVNamespace binding from the Workers runtime.
 * @returns A {@link CloudflareKvClient} adapter.
 */
export function wrapKVNamespace(kv: KVNamespaceLike): CloudflareKvClient {
  return {
    async get(key: string): Promise<string | null> {
      return kv.get(key, "text");
    },

    async getJson<T = unknown>(key: string): Promise<T | null> {
      return kv.get<T>(key, "json");
    },

    async put(
      key: string,
      value: string,
      options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
    ): Promise<void> {
      await kv.put(key, value, options);
    },

    async delete(key: string): Promise<void> {
      await kv.delete(key);
    },

    async list(options?: {
      limit?: number;
      prefix?: string;
      cursor?: string;
    }): Promise<{
      keys: Array<{ name: string; expiration?: number }>;
      list_complete: boolean;
      cursor?: string;
    }> {
      const result = await kv.list(options);
      return {
        keys: result.keys.map((k) => ({
          name: k.name,
          ...(k.expiration != null ? { expiration: k.expiration } : {}),
        })),
        list_complete: result.list_complete,
        ...(("cursor" in result && result.cursor) ? { cursor: result.cursor as string } : {}),
      };
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/cloudflare-kv/4.20260213.0/client-cf-kv.ts
git commit -m "feat(cloudflare-kv): add SDK adapter for KVNamespace (#57)"
```

---

### Task 8: Add public exports to src/index.ts

**Files:**
- Modify: `src/index.ts` — add cloudflare-kv exports following the stripe pattern

**Step 1: Add exports**

Add these exports to `src/index.ts` (after the existing stripe exports):

```ts
// ---- cloudflare-kv plugin ----
export type {
  CloudflareKvConfig,
  CloudflareKvMethods,
  KvPutOptions,
  KvListOptions,
  KvListResult,
} from "./plugins/cloudflare-kv/4.20260213.0";
export { cloudflareKv } from "./plugins/cloudflare-kv/4.20260213.0";
export { wrapKVNamespace } from "./plugins/cloudflare-kv/4.20260213.0/client-cf-kv";
export type { KVNamespaceLike } from "./plugins/cloudflare-kv/4.20260213.0/client-cf-kv";
export type {
  ClientHandlerOptions as CloudflareKvClientHandlerOptions,
  ClientHandlerState as CloudflareKvClientHandlerState,
} from "./plugins/cloudflare-kv/4.20260213.0/handler.client";
export { clientHandler as cloudflareKvClientHandler } from "./plugins/cloudflare-kv/4.20260213.0/handler.client";
export {
  serverEvaluate as cloudflareKvServerEvaluate,
  serverHandler as cloudflareKvServerHandler,
} from "./plugins/cloudflare-kv/4.20260213.0/handler.server";
export type { CloudflareKvClient } from "./plugins/cloudflare-kv/4.20260213.0/interpreter";
export { cloudflareKvInterpreter } from "./plugins/cloudflare-kv/4.20260213.0/interpreter";
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(cloudflare-kv): add public exports (#57)"
```

---

### Task 9: Validate — build, check, test

**Step 1: Run the full build**

Run: `npm run build`
Expected: No errors

**Step 2: Run the type checker**

Run: `npm run check`
Expected: No errors

**Step 3: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the new cloudflare-kv tests

**Step 4: Final commit if any fixes were needed**

If any fixes were required, commit them:

```bash
git add -A
git commit -m "fix(cloudflare-kv): address build/type/test issues (#57)"
```

---

### Task 10: Create PR

**Step 1: Push branch and create PR**

```bash
git push -u origin issue-57
gh pr create --title "feat: add cloudflare-kv plugin (#57)" --body "$(cat <<'EOF'
Closes #57

## What this does

Implements the `cloudflare-kv` plugin modeling Cloudflare Workers KV (`@cloudflare/workers-types` v4.20260213.0). Exposes `$.kv.get()`, `$.kv.getJson()`, `$.kv.put()`, `$.kv.delete()`, and `$.kv.list()` — the four core KV operations covering 95%+ of real-world usage.

## Design alignment

- **Plugin contract**: Three fields (`name`, `nodeKinds`, `build`), factory function pattern matching stripe plugin.
- **Namespaced node kinds**: All 5 kinds prefixed with `cloudflare-kv/`.
- **Source-level analysis**: Analyzed `KVNamespace` interface from `@cloudflare/workers-types` source (not docs). Honest assessment documents what maps cleanly vs. what can't be modeled.

## Validation performed

- `npm run build` — no errors
- `npm run check` — no type errors
- `npm test` — all tests pass (AST construction + interpreter effect tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
