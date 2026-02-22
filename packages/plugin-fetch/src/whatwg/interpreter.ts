import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapFetch } from "./client-fetch";
import type { FetchConfig } from "./index";

/**
 * Fetch client interface consumed by the fetch handler.
 *
 * Abstracts over the actual fetch implementation so handlers can be
 * tested with mock clients.
 */
export interface FetchClient {
  /** Execute an HTTP request and return the raw Response. */
  request(url: string, init?: RequestInit): Promise<Response>;
}

/**
 * Creates an interpreter for `fetch/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (baseUrl, defaultHeaders) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - Fetch effect execution client (defaults to globalThis.fetch).
 * @param config - Optional fetch config with baseUrl and defaultHeaders.
 * @returns An Interpreter handling all fetch node kinds.
 */
export function createFetchInterpreter(
  client: FetchClient = wrapFetch(globalThis.fetch),
  config: FetchConfig = {},
): Interpreter {
  return {
    "fetch/request": async function* (entry: RuntimeEntry) {
      const url = (yield 0) as string;
      const init = entry.children.length > 1 ? yield 1 : undefined;

      let resolvedUrl = url;
      if (config?.baseUrl && !url.startsWith("http://") && !url.startsWith("https://")) {
        resolvedUrl = `${config.baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
      }

      const mergedInit: RequestInit = { ...(init as RequestInit | undefined) };
      if (config?.defaultHeaders) {
        mergedInit.headers = {
          ...config.defaultHeaders,
          ...(mergedInit.headers as Record<string, string> | undefined),
        };
      }

      return await client.request(resolvedUrl, mergedInit);
    },

    "fetch/json": async function* (_entry: RuntimeEntry) {
      const response = (yield 0) as Response;
      return await response.json();
    },

    "fetch/text": async function* (_entry: RuntimeEntry) {
      const response = (yield 0) as Response;
      return await response.text();
    },

    "fetch/status": async function* (_entry: RuntimeEntry) {
      const response = (yield 0) as Response;
      return response.status;
    },

    "fetch/headers": async function* (_entry: RuntimeEntry) {
      const response = (yield 0) as Response;
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return headers;
    },

    "fetch/record": async function* (entry: RuntimeEntry) {
      // Children are key-value pairs: [key0, val0, key1, val1, ...]
      // Keys are string literals (out field), values need yielding.
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "fetch/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}

/**
 * Default fetch interpreter that uses `globalThis.fetch`.
 */
export const fetchInterpreter: Interpreter = createFetchInterpreter(wrapFetch(globalThis.fetch));
