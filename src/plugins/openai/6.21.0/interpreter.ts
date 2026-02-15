import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * OpenAI client interface consumed by the openai handler.
 *
 * Abstracts over the actual OpenAI SDK so handlers can be
 * tested with mock clients.
 */
export interface OpenAIClient {
  /** Execute an OpenAI API request and return the parsed response. */
  request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for openai plugin nodes.
 *
 * Yields `openai/api_call` effects for all 8 operations. Each effect
 * contains the HTTP method, API path, and optional body matching the
 * OpenAI REST API conventions.
 */
export const openaiInterpreter: InterpreterFragment = {
  pluginName: "openai",
  canHandle: (node) => node.kind.startsWith("openai/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Chat Completions ----

      case "openai/create_chat_completion": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/chat/completions",
          body,
        };
      }

      case "openai/retrieve_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "GET",
          path: `/chat/completions/${id}`,
        };
      }

      case "openai/list_chat_completions": {
        const body =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "openai/api_call",
          method: "GET",
          path: "/chat/completions",
          ...(body !== undefined ? { body } : {}),
        };
      }

      case "openai/update_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: `/chat/completions/${id}`,
          body,
        };
      }

      case "openai/delete_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "DELETE",
          path: `/chat/completions/${id}`,
        };
      }

      // ---- Embeddings ----

      case "openai/create_embedding": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/embeddings",
          body,
        };
      }

      // ---- Moderations ----

      case "openai/create_moderation": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/moderations",
          body,
        };
      }

      // ---- Legacy Completions ----

      case "openai/create_completion": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/completions",
          body,
        };
      }

      default:
        throw new Error(`OpenAI interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
