// ============================================================
// MVFM PLUGIN: fetch (WHATWG Fetch Standard)
// ============================================================
//
// Implementation status: COMPLETE (5 of 5 core operations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - fetch/request: fetch(url, init?) — the HTTP request
//   - fetch/json: response.json() — parse response as JSON
//   - fetch/text: response.text() — parse response as text
//   - fetch/status: response.status — get HTTP status code
//   - fetch/headers: response.headers — get response headers
//
// Not doable (fundamental mismatch with AST model):
//   - Streaming (response.body ReadableStream) — push-based,
//     no request-response shape
//   - AbortController/signal — runtime lifecycle management,
//     not representable in static AST
//   - Method syntax on response (response.json()) — mvfm uses
//     $.fetch.json(response) because AST proxies can't model
//     method calls on opaque handler-returned values
//
// Deferred (easy to add later, same pattern):
//   - response.blob()
//   - response.arrayBuffer()
//   - response.formData()
//   - response.ok (derivable from status)
//   - response.url
//   - response.redirected
//   - response.type
//
// ============================================================
//
// Goal: An LLM that knows the Fetch API should be able to
// write Mvfm programs with near-zero learning curve. The API
// mirrors globalThis.fetch() as closely as possible.
//
// Real Fetch API:
//   const response = await fetch('https://api.example.com/data')
//   const data = await response.json()
//   const text = await response.text()
//   const status = response.status
//   const headers = response.headers
//
// Mvfm fetch plugin:
//   const response = $.fetch('https://api.example.com/data')
//   const data = $.fetch.json(response)
//   const text = $.fetch.text(response)
//   const status = $.fetch.status(response)
//   const headers = $.fetch.headers(response)
//
// Based on the WHATWG Fetch Standard:
// https://fetch.spec.whatwg.org/
//
// The standard defines fetch() as a single function that takes
// a Request or URL string + optional RequestInit, returns a
// Promise<Response>. Response has body-reading methods (.json(),
// .text(), .arrayBuffer(), .blob(), .formData()) and metadata
// properties (.status, .headers, .ok, .url, .type, .redirected).
//
// ============================================================

import type { Expr, PluginContext } from "@mvfm/core";
import { definePlugin } from "@mvfm/core";
import { fetchInterpreter } from "./interpreter";

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
  fetch: ((
    url: Expr<string> | string,
    init?: Expr<FetchRequestInit> | FetchRequestInit,
  ) => Expr<unknown>) & {
    /** Parse the response body as JSON. Mirrors `response.json()`. */
    json(response: Expr<unknown>): Expr<unknown>;
    /** Read the response body as text. Mirrors `response.text()`. */
    text(response: Expr<unknown>): Expr<string>;
    /** Get the HTTP status code. Mirrors `response.status`. */
    status(response: Expr<unknown>): Expr<number>;
    /** Get the response headers as a record. Mirrors `response.headers`. */
    headers(response: Expr<unknown>): Expr<Record<string, string>>;
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

// ---- Plugin implementation --------------------------------

/**
 * Fetch plugin factory. Namespace: `fetch/`.
 *
 * Creates a plugin that exposes `$.fetch(url, init?)` for HTTP requests
 * and response-reading methods `.json()`, `.text()`, `.status()`, `.headers()`.
 *
 * @param config - Optional {@link FetchConfig} with baseUrl and defaultHeaders.
 * @returns A PluginDefinition for the fetch plugin.
 */
export function fetch(config?: FetchConfig) {
  const resolvedConfig = config ?? {};

  return definePlugin({
    name: "fetch",
    nodeKinds: ["fetch/request", "fetch/json", "fetch/text", "fetch/status", "fetch/headers"],
    defaultInterpreter: fetchInterpreter,

    build(ctx: PluginContext): FetchMethods {
      function resolveUrl(url: Expr<string> | string) {
        return ctx.isExpr(url) ? url.__node : ctx.lift(url).__node;
      }

      function resolveInit(init: Expr<FetchRequestInit> | FetchRequestInit) {
        return ctx.lift(init).__node;
      }

      function resolveResponse(response: Expr<unknown>) {
        return response.__node;
      }

      // $.fetch(url, init?) — callable function
      const fetchFn = (
        url: Expr<string> | string,
        init?: Expr<FetchRequestInit> | FetchRequestInit,
      ): Expr<unknown> => {
        return ctx.expr({
          kind: "fetch/request",
          url: resolveUrl(url),
          init: init != null ? resolveInit(init) : null,
          config: resolvedConfig,
        });
      };

      // Attach response-reading methods as properties on the function
      fetchFn.json = (response: Expr<unknown>): Expr<unknown> => {
        return ctx.expr({
          kind: "fetch/json",
          response: resolveResponse(response),
        });
      };

      fetchFn.text = (response: Expr<unknown>): Expr<string> => {
        return ctx.expr<string>({
          kind: "fetch/text",
          response: resolveResponse(response),
        });
      };

      fetchFn.status = (response: Expr<unknown>): Expr<number> => {
        return ctx.expr<number>({
          kind: "fetch/status",
          response: resolveResponse(response),
        });
      };

      fetchFn.headers = (response: Expr<unknown>): Expr<Record<string, string>> => {
        return ctx.expr<Record<string, string>>({
          kind: "fetch/headers",
          response: resolveResponse(response),
        });
      };

      return {
        fetch: fetchFn,
      };
    },
  });
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic GET request:
//    Real:  const response = await fetch('https://api.example.com/data')
//    Mvfm:   const response = $.fetch('https://api.example.com/data')
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. POST with body:
//    Real:  const response = await fetch(url, { method: 'POST', body: JSON.stringify(data) })
//    Mvfm:   const response = $.fetch(url, { method: 'POST', body: JSON.stringify(data) })
//    Same pattern, same options object.
//
// 3. Custom headers:
//    Real:  await fetch(url, { headers: { 'Authorization': 'Bearer ...' } })
//    Mvfm:   $.fetch(url, { headers: { 'Authorization': 'Bearer ...' } })
//    1:1 mapping.
//
// 4. Response parsing:
//    Real:  const data = await response.json()
//    Mvfm:   const data = $.fetch.json(response)
//    Different syntax (method on $.fetch vs method on response)
//    but semantically identical.
//
// 5. Parameterized with proxy values:
//    const response = $.fetch($.input.apiUrl, {
//      method: 'POST',
//      body: $.input.payload,
//    })
//    Proxy chains capture the dependency graph.
//
// WORKS BUT DIFFERENT:
//
// 6. Response method syntax:
//    Real:  response.json()
//    Mvfm:   $.fetch.json(response)
//    Necessary deviation — mvfm proxies can't add methods to
//    opaque handler-returned values. The response object in mvfm
//    is an Expr wrapping the fetch/request AST node, not the
//    real Response object.
//
// 7. Response metadata:
//    Real:  response.status (property access)
//    Mvfm:   $.fetch.status(response) (function call)
//    Same deviation — mvfm models this as a function call that
//    produces a new AST node, not property access on the response.
//
// DOESN'T WORK / NOT MODELED:
//
// 8. Streaming (response.body):
//    Real:  const reader = response.body.getReader()
//    Mvfm:   Not modeled. ReadableStream is push-based with no
//           request-response shape. Would need a cursor-like
//           pattern (see postgres cursor) to model.
//
// 9. AbortController:
//    Real:  const controller = new AbortController()
//           fetch(url, { signal: controller.signal })
//           controller.abort()
//    Mvfm:   Not modeled. Runtime lifecycle management (start,
//           cancel) is not representable in a static AST.
//
// 10. Error handling:
//    Real:  try { await fetch(url) } catch (e) { ... }
//    Mvfm:   $.attempt($.fetch(url)) via the error plugin.
//           Network errors become { ok: null, err: ... }.
//           HTTP error statuses (404, 500) do NOT throw in real
//           fetch — they return a Response with ok=false. Same
//           behavior here: the handler returns the response
//           regardless of status code.
//
// ============================================================
// SUMMARY:
// Based on the WHATWG Fetch Standard (https://fetch.spec.whatwg.org/).
//
// For the core 90% use case of "make an HTTP request, parse the
// response" — this is nearly identical to real fetch(). The main
// gap is response method syntax: $.fetch.json(response) instead
// of response.json(). This is a fundamental constraint of the
// AST proxy model, not a design choice.
//
// Not supported: streaming, AbortController, blob/arrayBuffer/
// formData body parsing (deferred, easy to add). These are
// either runtime concerns (streaming, abort) or mechanical
// additions (more body parsing modes).
// ============================================================
