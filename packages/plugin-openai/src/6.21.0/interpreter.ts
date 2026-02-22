import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapOpenAISdk } from "./client-openai-sdk";
import type { OpenAIConfig } from "./index";

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
 * Creates an interpreter for `openai/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (apiKey, org, project) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @returns An Interpreter handling all openai node kinds.
 */
export function createOpenAIInterpreter(client: OpenAIClient): Interpreter {
  return {
    "openai/create_chat_completion": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/chat/completions", body as Record<string, unknown>);
    },

    "openai/retrieve_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/chat/completions/${id}`);
    },

    "openai/list_chat_completions": async function* (entry: RuntimeEntry) {
      const body = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", "/chat/completions", body);
    },

    "openai/update_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      const body = yield 1;
      return await client.request(
        "POST",
        `/chat/completions/${id}`,
        body as Record<string, unknown>,
      );
    },

    "openai/delete_chat_completion": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("DELETE", `/chat/completions/${id}`);
    },

    "openai/create_embedding": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/embeddings", body as Record<string, unknown>);
    },

    "openai/create_moderation": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/moderations", body as Record<string, unknown>);
    },

    "openai/create_completion": async function* (_entry: RuntimeEntry) {
      const body = yield 0;
      return await client.request("POST", "/completions", body as Record<string, unknown>);
    },

    "openai/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "openai/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
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
            const OpenAI = moduleValue.default as new (
              opts: OpenAIConfig,
            ) => Parameters<typeof wrapOpenAISdk>[0];
            return wrapOpenAISdk(new OpenAI({ apiKey }));
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
