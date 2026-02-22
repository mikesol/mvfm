import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapAnthropicSdk } from "./client-anthropic-sdk";
import type { AnthropicConfig } from "./index";

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
 * Creates an interpreter for `anthropic/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (apiKey, baseURL) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @returns An Interpreter handling all anthropic node kinds.
 */
export function createAnthropicInterpreter(client: AnthropicClient): Interpreter {
  return {
    "anthropic/create_message": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/v1/messages", body as Record<string, unknown>);
    },

    "anthropic/count_tokens": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request(
        "POST",
        "/v1/messages/count_tokens",
        body as Record<string, unknown>,
      );
    },

    "anthropic/create_message_batch": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/v1/messages/batches", body as Record<string, unknown>);
    },

    "anthropic/retrieve_message_batch": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/v1/messages/batches/${id}`);
    },

    "anthropic/list_message_batches": async function* (entry: RuntimeEntry) {
      const body = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", "/v1/messages/batches", body);
    },

    "anthropic/delete_message_batch": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("DELETE", `/v1/messages/batches/${id}`);
    },

    "anthropic/cancel_message_batch": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("POST", `/v1/messages/batches/${id}/cancel`);
    },

    "anthropic/retrieve_model": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/v1/models/${id}`);
    },

    "anthropic/list_models": async function* (entry: RuntimeEntry) {
      const body = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", "/v1/models", body);
    },

    "anthropic/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "anthropic/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
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

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

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
        : {
            configurable: true,
            enumerable: true,
            writable: false,
            value: undefined,
          };
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
            const Anthropic = moduleValue.default as new (
              opts: AnthropicConfig,
            ) => Parameters<typeof wrapAnthropicSdk>[0];
            return wrapAnthropicSdk(new Anthropic({ apiKey }));
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
