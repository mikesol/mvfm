import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
import { wrapOpenAISdk } from "./client-openai-sdk";

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

function requiredEnv(name: "OPENAI_API_KEY"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-openai: missing ${name}. Set ${name} or use createOpenAIInterpreter(...)`,
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
 * Default OpenAI interpreter that uses `OPENAI_API_KEY`.
 */
export const openaiInterpreter: Interpreter = lazyInterpreter(() =>
  createOpenAIInterpreter(
    (() => {
      let clientPromise: Promise<OpenAIClient> | undefined;
      const getClient = async (): Promise<OpenAIClient> => {
        if (!clientPromise) {
          const apiKey = requiredEnv("OPENAI_API_KEY");
          clientPromise = dynamicImport("openai").then((moduleValue) => {
            const OpenAI = moduleValue.default;
            return wrapOpenAISdk(
              new OpenAI({
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
          body?: Record<string, unknown>,
        ): Promise<unknown> {
          const client = await getClient();
          return client.request(method, path, body);
        },
      } satisfies OpenAIClient;
    })(),
  ),
);
