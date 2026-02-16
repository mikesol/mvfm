import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
import { wrapAnthropicSdk } from "./client-anthropic-sdk";

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

interface AnthropicNode extends TypedNode<unknown> {
  kind: string;
  id?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
}

/**
 * Creates an interpreter for `anthropic/*` node kinds.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @returns An Interpreter handling all anthropic node kinds.
 */
export function createAnthropicInterpreter(client: AnthropicClient): Interpreter {
  return {
    "anthropic/create_message": async function* (node: AnthropicNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/messages", params);
    },

    "anthropic/count_tokens": async function* (node: AnthropicNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/messages/count_tokens", params);
    },

    "anthropic/create_message_batch": async function* (node: AnthropicNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/messages/batches", params);
    },

    "anthropic/retrieve_message_batch": async function* (node: AnthropicNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/messages/batches/${id}`);
    },

    "anthropic/list_message_batches": async function* (node: AnthropicNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/messages/batches", params);
    },

    "anthropic/delete_message_batch": async function* (node: AnthropicNode) {
      const id = yield* eval_(node.id!);
      return await client.request("DELETE", `/v1/messages/batches/${id}`);
    },

    "anthropic/cancel_message_batch": async function* (node: AnthropicNode) {
      const id = yield* eval_(node.id!);
      return await client.request("POST", `/v1/messages/batches/${id}/cancel`);
    },

    "anthropic/retrieve_model": async function* (node: AnthropicNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/models/${id}`);
    },

    "anthropic/list_models": async function* (node: AnthropicNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/models", params);
    },
  };
}

function requiredEnv(name: "ANTHROPIC_API_KEY"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-anthropic: missing ${name}. Set ${name} or use createAnthropicInterpreter(...)`,
    );
  }
  return value;
}

const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<any>;

function lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

/**
 * Default Anthropic interpreter that uses `ANTHROPIC_API_KEY`.
 */
export const anthropicInterpreter: Interpreter = lazyInterpreter(() =>
  createAnthropicInterpreter(
    (() => {
      let clientPromise: Promise<AnthropicClient> | undefined;
      const getClient = async (): Promise<AnthropicClient> => {
        if (!clientPromise) {
          const apiKey = requiredEnv("ANTHROPIC_API_KEY");
          clientPromise = dynamicImport("@anthropic-ai/sdk").then((moduleValue) => {
            const Anthropic = moduleValue.default;
            return wrapAnthropicSdk(
              new Anthropic({
                apiKey,
              }),
            );
          });
        }
        return clientPromise;
      };

      return {
        async request(
          method: string,
          path: string,
          params?: Record<string, unknown>,
        ): Promise<unknown> {
          const client = await getClient();
          return client.request(method, path, params);
        },
      } satisfies AnthropicClient;
    })(),
  ),
);
