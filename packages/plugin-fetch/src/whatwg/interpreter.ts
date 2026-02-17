import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_, typedInterpreter } from "@mvfm/core";
import { wrapFetch } from "./client-fetch";

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

/** A `fetch/request` node representing an HTTP request execution. */
export interface FetchRequestNode extends TypedNode<Response> {
  kind: "fetch/request";
  url: TypedNode<string>;
  init: TypedNode<unknown> | null;
  config: { baseUrl?: string; defaultHeaders?: Record<string, string> };
}

/** A `fetch/json` node representing `response.json()`. */
export interface FetchJsonNode extends TypedNode<unknown> {
  kind: "fetch/json";
  response: TypedNode<unknown>;
}

/** A `fetch/text` node representing `response.text()`. */
export interface FetchTextNode extends TypedNode<string> {
  kind: "fetch/text";
  response: TypedNode<unknown>;
}

/** A `fetch/status` node representing `response.status`. */
export interface FetchStatusNode extends TypedNode<number> {
  kind: "fetch/status";
  response: TypedNode<unknown>;
}

/** A `fetch/headers` node representing materialized response headers. */
export interface FetchHeadersNode extends TypedNode<Record<string, string>> {
  kind: "fetch/headers";
  response: TypedNode<unknown>;
}

type FetchKind = "fetch/request" | "fetch/json" | "fetch/text" | "fetch/status" | "fetch/headers";

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "fetch/request": FetchRequestNode;
    "fetch/json": FetchJsonNode;
    "fetch/text": FetchTextNode;
    "fetch/status": FetchStatusNode;
    "fetch/headers": FetchHeadersNode;
  }
}

/**
 * Creates an interpreter for `fetch/*` node kinds.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @returns An Interpreter handling all fetch node kinds.
 */
export function createFetchInterpreter(client: FetchClient): Interpreter {
  return typedInterpreter<FetchKind>()({
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

    "fetch/json": async function* (node: FetchJsonNode) {
      const response = yield* eval_(node.response);
      return await (response as Response).json();
    },

    "fetch/text": async function* (node: FetchTextNode) {
      const response = yield* eval_(node.response);
      return await (response as Response).text();
    },

    "fetch/status": async function* (node: FetchStatusNode) {
      const response = yield* eval_(node.response);
      return (response as Response).status;
    },

    "fetch/headers": async function* (node: FetchHeadersNode) {
      const response = yield* eval_(node.response);
      const headers: Record<string, string> = {};
      (response as Response).headers.forEach((v, k) => {
        headers[k] = v;
      });
      return headers;
    },
  });
}

/**
 * Default fetch interpreter that uses `globalThis.fetch`.
 */
export const fetchInterpreter: Interpreter = createFetchInterpreter(wrapFetch(globalThis.fetch));
