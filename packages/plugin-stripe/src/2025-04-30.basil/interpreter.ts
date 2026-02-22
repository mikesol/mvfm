import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapStripeSdk } from "./client-stripe-sdk";

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
 * Creates an interpreter for `stripe/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Config (apiKey, apiVersion) is captured in the closure,
 * not stored on AST nodes.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns An Interpreter handling all stripe node kinds.
 */
export function createStripeInterpreter(client: StripeClient): Interpreter {
  return {
    "stripe/create_payment_intent": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request("POST", "/v1/payment_intents", params as Record<string, unknown>);
    },

    "stripe/retrieve_payment_intent": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/v1/payment_intents/${id}`);
    },

    "stripe/confirm_payment_intent": async function* (entry: RuntimeEntry) {
      const id = yield 0;
      const params = entry.children.length > 1 ? ((yield 1) as Record<string, unknown>) : undefined;
      return await client.request("POST", `/v1/payment_intents/${id}/confirm`, params);
    },

    "stripe/create_customer": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request("POST", "/v1/customers", params as Record<string, unknown>);
    },

    "stripe/retrieve_customer": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/v1/customers/${id}`);
    },

    "stripe/update_customer": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      const params = yield 1;
      return await client.request("POST", `/v1/customers/${id}`, params as Record<string, unknown>);
    },

    "stripe/list_customers": async function* (entry: RuntimeEntry) {
      const params = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", "/v1/customers", params);
    },

    "stripe/create_charge": async function* (_entry: RuntimeEntry) {
      const params = yield 0;
      return await client.request("POST", "/v1/charges", params as Record<string, unknown>);
    },

    "stripe/retrieve_charge": async function* (_entry: RuntimeEntry) {
      const id = yield 0;
      return await client.request("GET", `/v1/charges/${id}`);
    },

    "stripe/list_charges": async function* (entry: RuntimeEntry) {
      const params = entry.children.length > 0 ? ((yield 0) as Record<string, unknown>) : undefined;
      return await client.request("GET", "/v1/charges", params);
    },

    "stripe/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "stripe/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
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
