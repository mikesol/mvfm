// ============================================================
// MVFM PLUGIN: cloudflare-kv (@cloudflare/workers-types KVNamespace)
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implementation status: COMPLETE (modulo known limitations)
//
// Known limitations (deliberate omissions):
//   - No arrayBuffer/stream return types (binary/streaming)
//   - No batch get (multi-key fetch)
//   - No getWithMetadata (deferred to pass 2)
//   - No cacheTtl option on get
//
// NO defaultInterpreter — requires createCloudflareKvInterpreter(client).
// ============================================================

import type { CExpr, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

// ---- liftArg: recursive plain-value -> CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `cloudflare-kv/record` CExprs with key-value child pairs.
 * - Arrays become `cloudflare-kv/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("cloudflare-kv/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("cloudflare-kv/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/** Return type of `kv.get()` — text or JSON depending on the type parameter. */
export interface KvGet {
  /** Get a text value by key. Returns null if key does not exist. */
  (key: CExpr<string> | string): CExpr<string | null>;
  /** Get a text value by key (explicit "text" type). */
  (key: CExpr<string> | string, type: "text"): CExpr<string | null>;
  /** Get a JSON-parsed value by key. Returns null if key does not exist. */
  <T = unknown>(key: CExpr<string> | string, type: "json"): CExpr<T | null>;
}

/**
 * Cloudflare KV operations added to the DSL context.
 *
 * Mirrors the KVNamespace API: get, put, delete, list.
 * Each method produces a namespaced CExpr node.
 */
export interface CloudflareKvMethods {
  /** Cloudflare KV operations, namespaced under `$.kv`. */
  kv: {
    /** Get a value by key. Pass "json" as second arg to parse JSON. */
    get: KvGet;
    /** Store a string value at key with optional expiration settings. */
    put(
      key: CExpr<string> | string,
      value: CExpr<string> | string,
      options?: CExpr<KvPutOptions> | KvPutOptions,
    ): CExpr<void>;
    /** Delete a key. */
    delete(key: CExpr<string> | string): CExpr<void>;
    /** List keys with optional prefix filter and pagination cursor. */
    list(options?: CExpr<KvListOptions> | KvListOptions): CExpr<KvListResult>;
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

// ---- Node kinds -------------------------------------------

const NODE_KINDS = [
  "cloudflare-kv/get",
  "cloudflare-kv/get_json",
  "cloudflare-kv/put",
  "cloudflare-kv/delete",
  "cloudflare-kv/list",
  "cloudflare-kv/record",
  "cloudflare-kv/array",
] as const;

function buildKinds(): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const kind of NODE_KINDS) {
    kinds[kind] = {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>;
  }
  return kinds;
}

// ---- Constructor builder ----------------------------------

function buildKvApi(): CloudflareKvMethods["kv"] {
  return {
    get: ((key: CExpr<string> | string, type?: "text" | "json") => {
      if (type === "json") {
        return makeCExpr("cloudflare-kv/get_json", [liftArg(key)]);
      }
      return makeCExpr("cloudflare-kv/get", [liftArg(key)]);
    }) as KvGet,

    put(key, value, options?) {
      const children: unknown[] = [liftArg(key), liftArg(value)];
      if (options != null) {
        children.push(liftArg(options));
      }
      return makeCExpr("cloudflare-kv/put", children);
    },

    delete(key) {
      return makeCExpr("cloudflare-kv/delete", [liftArg(key)]);
    },

    list(options?) {
      if (options != null) {
        return makeCExpr("cloudflare-kv/list", [liftArg(options)]);
      }
      return makeCExpr("cloudflare-kv/list", []);
    },
  };
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the cloudflare-kv plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { "cloudflare-kv": createCloudflareKvInterpreter(client) })`.
 *
 * @param _config - A {@link CloudflareKvConfig} with namespaceId.
 *   Config is captured by the interpreter, not stored on AST nodes.
 * @returns A unified Plugin that contributes `$.kv`.
 *
 * @example
 * ```ts
 * const plugin = cloudflareKv({ namespaceId: "MY_KV" });
 * const $ = mvfmU(numPluginU, strPluginU, plugin);
 * const expr = $.kv.get("my-key");
 * const nexpr = app(expr);
 * const interp = defaults([numPluginU, strPluginU, plugin], {
 *   "cloudflare-kv": createCloudflareKvInterpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export function cloudflareKv(_config: CloudflareKvConfig) {
  return {
    name: "cloudflare-kv" as const,
    ctors: { kv: buildKvApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds: [...NODE_KINDS],
  };
}

/**
 * Alias for {@link cloudflareKv}, kept for readability at call sites.
 */
export const cloudflareKvPlugin = cloudflareKv;
