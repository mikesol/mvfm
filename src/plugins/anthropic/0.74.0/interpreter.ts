import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Anthropic client interface consumed by the anthropic handler.
 *
 * Abstracts over the actual Anthropic SDK so handlers can be
 * tested with mock clients.
 */
export interface AnthropicClient {
  /** Execute an Anthropic API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for anthropic plugin nodes.
 *
 * Yields `anthropic/api_call` effects for all 9 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Anthropic REST API conventions (as defined by @anthropic-ai/sdk).
 */
export const anthropicInterpreter: InterpreterFragment = {
  pluginName: "anthropic",
  canHandle: (node) => node.kind.startsWith("anthropic/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Messages ----

      case "anthropic/create_message": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages",
          params,
        };
      }

      case "anthropic/count_tokens": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages/count_tokens",
          params,
        };
      }

      // ---- Message Batches ----

      case "anthropic/create_message_batch": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages/batches",
          params,
        };
      }

      case "anthropic/retrieve_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: `/v1/messages/batches/${id}`,
        };
      }

      case "anthropic/list_message_batches": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: "/v1/messages/batches",
          ...(params !== undefined ? { params } : {}),
        };
      }

      case "anthropic/delete_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "DELETE",
          path: `/v1/messages/batches/${id}`,
        };
      }

      case "anthropic/cancel_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: `/v1/messages/batches/${id}/cancel`,
        };
      }

      // ---- Models ----

      case "anthropic/retrieve_model": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: `/v1/models/${id}`,
        };
      }

      case "anthropic/list_models": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: "/v1/models",
          ...(params !== undefined ? { params } : {}),
        };
      }

      default:
        throw new Error(`Anthropic interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
