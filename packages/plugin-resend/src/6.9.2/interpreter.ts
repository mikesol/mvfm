import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapResendSdk } from "./client-resend-sdk";

/**
 * Resend client interface consumed by the resend handler.
 *
 * Abstracts over the actual Resend SDK so handlers can be
 * tested with mock clients.
 */
export interface ResendClient {
  /** Execute a Resend API request and return the parsed response. */
  request(method: string, path: string, params?: unknown): Promise<unknown>;
}

/**
 * Creates an interpreter for `resend/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns An Interpreter handling all resend node kinds.
 */
export function createResendInterpreter(client: ResendClient): Interpreter {
  return {
    "resend/send_email": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request("POST", "/emails", params);
    },

    "resend/get_email": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/emails/${id}`);
    },

    "resend/send_batch": async function* (_entry: RuntimeEntry) {
      const emails = yield 0;
      return await client.request("POST", "/emails/batch", emails);
    },

    "resend/create_contact": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request("POST", "/contacts", params);
    },

    "resend/get_contact": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/contacts/${id}`);
    },

    "resend/list_contacts": async function* (_entry: RuntimeEntry) {
      return await client.request("GET", "/contacts");
    },

    "resend/remove_contact": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("DELETE", `/contacts/${id}`);
    },

    "resend/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "resend/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}

function requiredEnv(name: "RESEND_API_KEY"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-resend: missing ${name}. Set ${name} or use createResendInterpreter(...)`,
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
 * Default Resend interpreter that uses `RESEND_API_KEY`.
 */
export const resendInterpreter: Interpreter = lazyInterpreter(() =>
  createResendInterpreter(
    (() => {
      let clientPromise: Promise<ResendClient> | undefined;
      const getClient = async (): Promise<ResendClient> => {
        if (!clientPromise) {
          const apiKey = requiredEnv("RESEND_API_KEY");
          clientPromise = dynamicImport("resend").then((moduleValue) => {
            const Resend = moduleValue.Resend as new (key: string) => Record<string, unknown>;
            return wrapResendSdk(
              new Resend(apiKey) as unknown as Parameters<typeof wrapResendSdk>[0],
            );
          });
        }
        return clientPromise;
      };

      return {
        async request(method: string, path: string, params?: unknown): Promise<unknown> {
          const client = await getClient();
          return client.request(method, path, params);
        },
      } satisfies ResendClient;
    })(),
  ),
);
