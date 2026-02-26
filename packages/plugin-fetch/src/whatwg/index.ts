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

import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
import { wrapFetch } from "./client-fetch";
import { createFetchInterpreter } from "./interpreter";

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
 * Configuration for the fetch plugin interpreter.
 */
export interface FetchConfig {
  /** Base URL prepended to relative URLs (e.g. `https://api.example.com`). */
  baseUrl?: string;
  /** Default headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

// ---- Plugin factory ---------------------------------------

/**
 * Builds the callable fetch constructor with permissive generics.
 *
 * The returned function is callable (`fetch(url, init?)`) and also
 * has `.json()`, `.text()`, `.status()`, `.headers()` methods.
 * All return types include kind strings for ExtractKinds.
 */
function buildFetchApi() {
  const fetchFn = (
    url: string | CExpr<string>,
    ...init: [] | [Liftable<FetchRequestInit>]
  ): CExpr<
    unknown,
    "fetch/request",
    [string | CExpr<string>] | [string | CExpr<string>, Liftable<FetchRequestInit>]
  > => {
    return makeCExpr("fetch/request", [url, ...init] as unknown[]) as any;
  };

  /** Parse the response body as JSON. Mirrors `response.json()`. */
  fetchFn.json = <A>(response: A): CExpr<unknown, "fetch/json", [A]> =>
    makeCExpr("fetch/json", [response]) as any;

  /** Read the response body as text. Mirrors `response.text()`. */
  fetchFn.text = <A>(response: A): CExpr<string, "fetch/text", [A]> =>
    makeCExpr("fetch/text", [response]) as any;

  /** Get the HTTP status code. Mirrors `response.status`. */
  fetchFn.status = <A>(response: A): CExpr<number, "fetch/status", [A]> =>
    makeCExpr("fetch/status", [response]) as any;

  /** Get the response headers as a record. Mirrors `response.headers`. */
  fetchFn.headers = <A>(response: A): CExpr<Record<string, string>, "fetch/headers", [A]> =>
    makeCExpr("fetch/headers", [response]) as any;

  return fetchFn;
}

/**
 * The fetch plugin definition (unified Plugin type).
 *
 * Contributes `$.fetch` with request, json, text, status, and headers methods.
 * Uses the global `fetch` function as its default interpreter.
 */
export const fetch = {
  name: "fetch" as const,
  ctors: { fetch: buildFetchApi() },
  kinds: {
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
  },
  shapes: {
    "fetch/request": [null, "*"] as [null, "*"],
  },
  traits: {},
  lifts: {},
  defaultInterpreter: (): Interpreter => createFetchInterpreter(wrapFetch(globalThis.fetch), {}),
} satisfies Plugin;

/**
 * Alias for {@link fetch}, kept for readability at call sites.
 */
export const fetchPlugin = fetch;
