import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

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
 * Generator-based interpreter fragment for fetch plugin nodes.
 *
 * Yields two effect types:
 * - `fetch/http_request`: for fetch/request nodes (the actual HTTP call)
 * - `fetch/read_body`: for fetch/json, fetch/text, fetch/status, fetch/headers
 *   (reading response body or metadata)
 */
export const fetchInterpreter: InterpreterFragment = {
  pluginName: "fetch",
  canHandle: (node) => node.kind.startsWith("fetch/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "fetch/request": {
        const url = yield { type: "recurse", child: node.url as ASTNode };
        const init =
          node.init != null ? yield { type: "recurse", child: node.init as ASTNode } : undefined;
        return yield {
          type: "fetch/http_request",
          url,
          ...(init !== undefined ? { init } : {}),
          config: node.config,
        };
      }

      case "fetch/json": {
        const response = yield { type: "recurse", child: node.response as ASTNode };
        return yield {
          type: "fetch/read_body",
          response,
          mode: "json",
        };
      }

      case "fetch/text": {
        const response = yield { type: "recurse", child: node.response as ASTNode };
        return yield {
          type: "fetch/read_body",
          response,
          mode: "text",
        };
      }

      case "fetch/status": {
        const response = yield { type: "recurse", child: node.response as ASTNode };
        return yield {
          type: "fetch/read_body",
          response,
          mode: "status",
        };
      }

      case "fetch/headers": {
        const response = yield { type: "recurse", child: node.response as ASTNode };
        return yield {
          type: "fetch/read_body",
          response,
          mode: "headers",
        };
      }

      default:
        throw new Error(`Fetch interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
