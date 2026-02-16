import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface FetchRequestNode extends TypedNode<unknown> {
  kind: "fetch/request";
  url: TypedNode<string>;
  init: TypedNode | null;
  config: { baseUrl?: string; defaultHeaders?: Record<string, string> };
}

interface FetchResponseNode extends TypedNode<unknown> {
  kind: string;
  response: TypedNode<Response>;
}

/**
 * Creates an interpreter for `fetch/*` node kinds.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @returns An Interpreter handling all fetch node kinds.
 */
export function createFetchInterpreter(client: FetchClient): Interpreter {
  return {
    "fetch/request": async function* (node: FetchRequestNode) {
      const url = yield* eval_(node.url);
      const init = node.init != null ? yield* eval_(node.init) : undefined;

      let resolvedUrl = url;
      const config = node.config;
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

    "fetch/json": async function* (node: FetchResponseNode) {
      const response = yield* eval_(node.response);
      return await response.json();
    },

    "fetch/text": async function* (node: FetchResponseNode) {
      const response = yield* eval_(node.response);
      return await response.text();
    },

    "fetch/status": async function* (node: FetchResponseNode) {
      const response = yield* eval_(node.response);
      return response.status;
    },

    "fetch/headers": async function* (node: FetchResponseNode) {
      const response = yield* eval_(node.response);
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headers[k] = v;
      });
      return headers;
    },
  };
}
