// ============================================================
// MVFM PLUGIN: fetch (WHATWG Fetch Standard) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - fetch/request: fetch(url, init?) — the HTTP request
//   - fetch/json: response.json() — parse response as JSON
//   - fetch/text: response.text() — parse response as text
//   - fetch/status: response.status — get HTTP status code
//   - fetch/headers: response.headers — get response headers
// ============================================================

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapFetch } from "./client-fetch";
import { createFetchInterpreter } from "./interpreter";

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives (string, number, boolean) become literal CExprs via makeCExpr.
 * - Plain objects become `fetch/record` CExprs with key-value child pairs.
 * - Arrays become `fetch/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value; // elaborate lifts strings via str/literal
  if (typeof value === "number") return value; // elaborate lifts numbers via num/literal
  if (typeof value === "boolean") return value; // elaborate lifts booleans via bool/literal
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("fetch/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    // Convert {key: val, ...} → makeCExpr("fetch/record", [key1, val1, key2, val2, ...])
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("fetch/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/**
 * Request initialization options, mirroring the WHATWG RequestInit interface.
 *
 * Accepts the standard fetch options: method, headers, body, etc.
 */
export interface FetchRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  mode?: string;
  credentials?: string;
  cache?: string;
  redirect?: string;
  referrer?: string;
  referrerPolicy?: string;
  integrity?: string;
  keepalive?: boolean;
}

/**
 * Fetch operations added to the DSL context by the fetch plugin.
 *
 * `$.fetch(url, init?)` makes an HTTP request (mirrors `globalThis.fetch`).
 * `$.fetch.json(response)`, `$.fetch.text(response)`, etc. read the response.
 */
export interface FetchMethods {
  /**
   * Callable: `$.fetch(url, init?)` makes an HTTP request.
   * Also has properties for response reading: `.json()`, `.text()`, `.status()`, `.headers()`.
   */
  fetch: (<A, B>(url: A, init?: B) => CExpr<unknown>) & {
    /** Parse the response body as JSON. Mirrors `response.json()`. */
    json<A>(response: A): CExpr<unknown>;
    /** Read the response body as text. Mirrors `response.text()`. */
    text<A>(response: A): CExpr<string>;
    /** Get the HTTP status code. Mirrors `response.status`. */
    status<A>(response: A): CExpr<number>;
    /** Get the response headers as a record. Mirrors `response.headers`. */
    headers<A>(response: A): CExpr<Record<string, string>>;
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the fetch plugin.
 *
 * All fields are optional. When provided, `baseUrl` is prepended
 * to relative URLs and `defaultHeaders` are merged into every request.
 */
export interface FetchConfig {
  /** Base URL prepended to relative URLs (e.g. `https://api.example.com`). */
  baseUrl?: string;
  /** Default headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
    "fetch/request": {
      inputs: ["", undefined] as [string, ...unknown[]],
      output: undefined as unknown,
    } as KindSpec<[string, ...unknown[]], unknown>,
    "fetch/json": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "fetch/text": {
      inputs: [undefined] as [unknown],
      output: "" as string,
    } as KindSpec<[unknown], string>,
    "fetch/status": {
      inputs: [undefined] as [unknown],
      output: 0 as number,
    } as KindSpec<[unknown], number>,
    "fetch/headers": {
      inputs: [undefined] as [unknown],
      output: {} as Record<string, string>,
    } as KindSpec<[unknown], Record<string, string>>,
    "fetch/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "fetch/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}

// ---- Constructor builder ----------------------------------

function buildFetchApi(): FetchMethods["fetch"] {
  const fetchFn = <A, B>(url: A, init?: B): CExpr<unknown> =>
    init != null
      ? makeCExpr("fetch/request", [url, liftArg(init)])
      : makeCExpr("fetch/request", [url]);

  fetchFn.json = <A>(response: A): CExpr<unknown> => makeCExpr("fetch/json", [response]);

  fetchFn.text = <A>(response: A): CExpr<string> => makeCExpr("fetch/text", [response]);

  fetchFn.status = <A>(response: A): CExpr<number> => makeCExpr("fetch/status", [response]);

  fetchFn.headers = <A>(response: A): CExpr<Record<string, string>> =>
    makeCExpr("fetch/headers", [response]);

  return fetchFn;
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the fetch plugin definition (unified Plugin type).
 *
 * @param config - Optional {@link FetchConfig} with baseUrl and defaultHeaders.
 * @returns A unified Plugin that contributes `$.fetch`.
 */
export function fetch(config?: FetchConfig) {
  const resolvedConfig = config ?? {};

  return {
    name: "fetch" as const,
    ctors: { fetch: buildFetchApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter =>
      createFetchInterpreter(wrapFetch(globalThis.fetch), resolvedConfig),
  };
}

/**
 * Alias for {@link fetch}, kept for readability at call sites.
 */
export const fetchPlugin = fetch;
