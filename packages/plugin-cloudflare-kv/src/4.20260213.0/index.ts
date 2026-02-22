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

import type { CExpr, KindSpec, Plugin } from "@mvfm/core";
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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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

// ---- Overloaded get constructor ----------------------------

/** Get a text value by key. Returns null if key does not exist. */
function kvGet<A>(key: A): CExpr<string | null, "cloudflare-kv/get", [A]>;
/** Get a text value by key (explicit "text" type). */
function kvGet<A>(key: A, type: "text"): CExpr<string | null, "cloudflare-kv/get", [A]>;
/** Get a JSON-parsed value by key. Returns null if key does not exist. */
function kvGet<A>(key: A, type: "json"): CExpr<unknown, "cloudflare-kv/get_json", [A]>;
function kvGet<A>(key: A, type?: "text" | "json") {
  if (type === "json") {
    return mk("cloudflare-kv/get_json", [liftArg(key)]);
  }
  return mk("cloudflare-kv/get", [liftArg(key)]);
}

// ---- Constructor builder ----------------------------------

/**
 * Builds the cloudflare-kv constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildKvApi() {
  return {
    /** Get a value by key. Pass "json" as second arg to parse JSON. */
    get: kvGet,

    /** Store a string value at key with optional expiration settings. */
    put<A, B, C extends readonly unknown[]>(
      key: A,
      value: B,
      ...args: C
    ): CExpr<void, "cloudflare-kv/put", [A, B, ...C]> {
      const children: unknown[] = [liftArg(key), liftArg(value)];
      for (const a of args) {
        children.push(liftArg(a));
      }
      return mk("cloudflare-kv/put", children);
    },

    /** Delete a key. */
    delete<A>(key: A): CExpr<void, "cloudflare-kv/delete", [A]> {
      return mk("cloudflare-kv/delete", [liftArg(key)]);
    },

    /** List keys with optional prefix filter and pagination cursor. */
    list<A extends readonly unknown[]>(...args: A): CExpr<KvListResult, "cloudflare-kv/list", A> {
      return mk(
        "cloudflare-kv/list",
        args.map((a) => liftArg(a)),
      );
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
 * const $ = composeDollar(numPlugin, strPlugin, plugin);
 * const expr = $.kv.get("my-key");
 * const nexpr = app(expr);
 * const interp = defaults([numPlugin, strPlugin, plugin], {
 *   "cloudflare-kv": createCloudflareKvInterpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export function cloudflareKv(_config: CloudflareKvConfig) {
  return {
    name: "cloudflare-kv" as const,
    ctors: { kv: buildKvApi() },
    kinds: {
      "cloudflare-kv/get": {
        inputs: [""] as [string],
        output: null as string | null,
      } as KindSpec<[string], string | null>,
      "cloudflare-kv/get_json": {
        inputs: [""] as [string],
        output: undefined as unknown,
      } as KindSpec<[string], unknown>,
      "cloudflare-kv/put": {
        inputs: ["", ""] as [string, string],
        output: undefined as unknown as undefined,
      } as KindSpec<[string, string], void>,
      "cloudflare-kv/delete": {
        inputs: [""] as [string],
        output: undefined as unknown as undefined,
      } as KindSpec<[string], void>,
      "cloudflare-kv/list": {
        inputs: [undefined] as [unknown],
        output: undefined as unknown,
      } as KindSpec<[unknown], unknown>,
      // Structural helpers (produced by liftArg)
      "cloudflare-kv/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "cloudflare-kv/array": {
        inputs: [] as unknown[],
        output: [] as unknown[],
      } as KindSpec<unknown[], unknown[]>,
    },
    traits: {},
    lifts: {},
  } satisfies Plugin;
}

/**
 * Alias for {@link cloudflareKv}, kept for readability at call sites.
 */
export const cloudflareKvPlugin = cloudflareKv;
