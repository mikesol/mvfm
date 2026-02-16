import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
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

interface ResendNode extends TypedNode<unknown> {
  kind: string;
  id?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
  emails?: TypedNode<unknown[]>;
}

/**
 * Creates an interpreter for `resend/*` node kinds.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns An Interpreter handling all resend node kinds.
 */
export function createResendInterpreter(client: ResendClient): Interpreter {
  return {
    "resend/send_email": async function* (node: ResendNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/emails", params);
    },

    "resend/get_email": async function* (node: ResendNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/emails/${id}`);
    },

    "resend/send_batch": async function* (node: ResendNode) {
      const emails = yield* eval_(node.emails!);
      return await client.request("POST", "/emails/batch", emails);
    },

    "resend/create_contact": async function* (node: ResendNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/contacts", params);
    },

    "resend/get_contact": async function* (node: ResendNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/contacts/${id}`);
    },

    // biome-ignore lint/correctness/useYield: no child nodes to evaluate
    "resend/list_contacts": async function* () {
      return await client.request("GET", "/contacts");
    },

    "resend/remove_contact": async function* (node: ResendNode) {
      const id = yield* eval_(node.id!);
      return await client.request("DELETE", `/contacts/${id}`);
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
            const Resend = moduleValue.Resend;
            return wrapResendSdk(new Resend(apiKey) as any);
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
