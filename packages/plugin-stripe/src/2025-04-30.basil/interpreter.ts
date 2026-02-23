import type { Interpreter } from "@mvfm/core";
import { wrapStripeSdk } from "./client-stripe-sdk";
import { makeHandlers, structuralHandlers } from "./registry";
import { flatResourceDefs } from "./resources";

/**
 * Stripe client interface consumed by the stripe handler.
 *
 * Abstracts over the actual Stripe SDK so handlers can be
 * tested with mock clients.
 */
export interface StripeClient {
  /** Execute a Stripe API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Creates an interpreter for `stripe/*` node kinds using the
 * registry-driven handler generation.
 *
 * Config (apiKey, apiVersion) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns An Interpreter handling all stripe node kinds.
 */
export function createStripeInterpreter(client: StripeClient): Interpreter {
  const handlers: Interpreter = {};
  for (const def of flatResourceDefs()) {
    Object.assign(handlers, makeHandlers(def, client));
  }
  Object.assign(handlers, structuralHandlers(client));
  return handlers;
}

function requiredEnv(name: "STRIPE_API_KEY"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-stripe: missing ${name}. Set ${name} or use createStripeInterpreter(...)`,
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
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

/**
 * Default Stripe interpreter that uses `STRIPE_API_KEY`.
 */
export const stripeInterpreter: Interpreter = lazyInterpreter(() =>
  createStripeInterpreter(
    (() => {
      let clientPromise: Promise<StripeClient> | undefined;
      const getClient = async (): Promise<StripeClient> => {
        if (!clientPromise) {
          const apiKey = requiredEnv("STRIPE_API_KEY");
          clientPromise = dynamicImport("stripe").then((moduleValue) => {
            const Stripe = moduleValue.default as new (
              apiKey: string,
            ) => Parameters<typeof wrapStripeSdk>[0];
            return wrapStripeSdk(new Stripe(apiKey));
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
      } satisfies StripeClient;
    })(),
  ),
);
