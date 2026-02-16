import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface OpenAINode extends TypedNode<unknown> {
  kind: string;
  id?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
}

/**
 * Creates an interpreter for `openai/*` node kinds.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @returns An Interpreter handling all openai node kinds.
 */
export function createOpenAIInterpreter(client: OpenAIClient): Interpreter {
  return {
    "openai/create_chat_completion": async function* (node: OpenAINode) {
      const body = yield* eval_(node.params!);
      return await client.request("POST", "/chat/completions", body);
    },

    "openai/retrieve_chat_completion": async function* (node: OpenAINode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/chat/completions/${id}`);
    },

    "openai/list_chat_completions": async function* (node: OpenAINode) {
      const body = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/chat/completions", body);
    },

    "openai/update_chat_completion": async function* (node: OpenAINode) {
      const id = yield* eval_(node.id!);
      const body = yield* eval_(node.params!);
      return await client.request("POST", `/chat/completions/${id}`, body);
    },

    "openai/delete_chat_completion": async function* (node: OpenAINode) {
      const id = yield* eval_(node.id!);
      return await client.request("DELETE", `/chat/completions/${id}`);
    },

    "openai/create_embedding": async function* (node: OpenAINode) {
      const body = yield* eval_(node.params!);
      return await client.request("POST", "/embeddings", body);
    },

    "openai/create_moderation": async function* (node: OpenAINode) {
      const body = yield* eval_(node.params!);
      return await client.request("POST", "/moderations", body);
    },

    "openai/create_completion": async function* (node: OpenAINode) {
      const body = yield* eval_(node.params!);
      return await client.request("POST", "/completions", body);
    },
  };
}
