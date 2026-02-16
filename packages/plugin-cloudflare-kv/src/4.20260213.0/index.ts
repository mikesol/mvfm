// ============================================================
// MVFM PLUGIN: cloudflare-kv (@cloudflare/workers-types KVNamespace)
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
// be able to write Mvfm programs with near-zero learning curve.
// The API mirrors the real KVNamespace 1:1 for supported ops.
//
// Real KVNamespace API (@cloudflare/workers-types 4.20260213.0):
//   const value = await KV.get("key")
//   const json = await KV.get("key", "json")
//   await KV.put("key", "value", { expirationTtl: 3600 })
//   await KV.delete("key")
//   const list = await KV.list({ prefix: "user:" })
//
// Mvfm API (1:1 match):
//   const value = $.kv.get("key")
//   const json = $.kv.get("key", "json")
//   $.kv.put("key", "value", { expirationTtl: 3600 })
//   $.kv.delete("key")
//   const list = $.kv.list({ prefix: "user:" })
//
// No deviations from the real API for supported operations.
// The "type" parameter on get() is a build-time literal string,
// so it maps cleanly to distinct AST node kinds internally.
//
// Based on source-level analysis of @cloudflare/workers-types
// v4.20260213.0 — the KVNamespace interface (latest/index.ts
// lines 2159-2272).
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition, TypedNode } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/** Return type of `kv.get()` — text or JSON depending on the type parameter. */
export interface KvGet {
  /** Get a text value by key. Returns null if key does not exist. */
  (key: Expr<string> | string): Expr<string | null>;
  /** Get a text value by key (explicit "text" type). */
  (key: Expr<string> | string, type: "text"): Expr<string | null>;
  /** Get a JSON-parsed value by key. Returns null if key does not exist. */
  <T = unknown>(key: Expr<string> | string, type: "json"): Expr<T | null>;
}

/**
 * Cloudflare KV operations added to the DSL context.
 *
 * Mirrors the KVNamespace API: get, put, delete, list.
 * Each method produces a namespaced AST node.
 */
export interface CloudflareKvMethods {
  /** Cloudflare KV operations, namespaced under `$.kv`. */
  kv: {
    /** Get a value by key. Pass "json" as second arg to parse JSON. */
    get: KvGet;
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
 * Creates a plugin that exposes get, put, delete, and list
 * methods for building Cloudflare KV AST nodes.
 *
 * @param config - A {@link CloudflareKvConfig} with namespaceId.
 * @returns A PluginDefinition for the cloudflare-kv plugin.
 */
export function cloudflareKv(config: CloudflareKvConfig): PluginDefinition<CloudflareKvMethods> {
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
      function resolveKey(key: Expr<string> | string): TypedNode {
        return ctx.isExpr(key) ? key.__node : ctx.lift(key).__node;
      }

      return {
        kv: {
          get: ((key: Expr<string> | string, type?: "text" | "json") => {
            if (type === "json") {
              return ctx.expr<unknown>({
                kind: "cloudflare-kv/get_json",
                key: resolveKey(key),
                config,
              });
            }
            return ctx.expr<string | null>({
              kind: "cloudflare-kv/get",
              key: resolveKey(key),
              config,
            });
          }) as KvGet,

          put(key, value, options?) {
            return ctx.expr({
              kind: "cloudflare-kv/put",
              key: resolveKey(key),
              value: ctx.isExpr(value) ? value.__node : ctx.lift(value).__node,
              options: options != null ? ctx.lift(options).__node : null,
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
              options: options != null ? ctx.lift(options).__node : null,
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
//    Mvfm:   const val = $.kv.get("key")
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. JSON values:
//    Real:  const data = await KV.get("key", "json")
//    Mvfm:   const data = $.kv.get("key", "json")
//    1:1 mapping. Same call signature.
//
// 3. Put with expiration:
//    Real:  await KV.put("key", "val", { expirationTtl: 3600 })
//    Mvfm:   $.kv.put("key", "val", { expirationTtl: 3600 })
//    1:1 mapping.
//
// 4. List with prefix/cursor:
//    Real:  const result = await KV.list({ prefix: "user:" })
//    Mvfm:   const result = $.kv.list({ prefix: "user:" })
//    1:1 mapping. Pagination via cursor works naturally.
//
// 5. Parameterized keys:
//    const val = $.kv.get($.input.cacheKey)
//    Proxy chains capture key dependencies perfectly.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Binary/streaming:
//    Real:  KV.get("key", "arrayBuffer") / KV.get("key", "stream")
//    Mvfm:   Not modeled. Binary data and streams don't fit a
//           finite, inspectable AST.
//
// 7. getWithMetadata:
//    Real:  KV.getWithMetadata("key")
//    Mvfm:   Not yet modeled. Returns {value, metadata, cacheStatus}.
//           Could be added as cloudflare-kv/get_with_metadata.
//
// 8. Batch get:
//    Real:  KV.get(["key1", "key2"])
//    Mvfm:   Not yet modeled. Multi-key fetch returns a Map.
//           Could be added as cloudflare-kv/get_batch.
//
// 9. Metadata on put:
//    Real:  KV.put("key", "val", { metadata: { foo: "bar" } })
//    Mvfm:   Partially modeled — the options type includes metadata
//           but the handler ignores it for now.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of @cloudflare/workers-types
// v4.20260213.0 (KVNamespace interface, latest/index.ts).
//
// For the core use case of "store and retrieve string/JSON
// values by key with optional expiration" — this is a 1:1
// match with the real KVNamespace API. No deviations for
// supported operations.
//
// Not supported: binary data (arrayBuffer), streaming,
// getWithMetadata, batch get. These could be added
// incrementally in future passes.
// ============================================================
