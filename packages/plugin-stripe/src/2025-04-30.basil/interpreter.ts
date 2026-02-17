import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_, typedInterpreter } from "@mvfm/core";
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

interface StripeNode<K extends string> extends TypedNode<unknown> {
  kind: K;
  id?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
}

interface StripeCreatePaymentIntentNode extends StripeNode<"stripe/create_payment_intent"> {
  params: TypedNode<Record<string, unknown>>;
}
interface StripeRetrievePaymentIntentNode extends StripeNode<"stripe/retrieve_payment_intent"> {
  id: TypedNode<string>;
}
interface StripeConfirmPaymentIntentNode extends StripeNode<"stripe/confirm_payment_intent"> {
  id: TypedNode<string>;
}
interface StripeCreateCustomerNode extends StripeNode<"stripe/create_customer"> {
  params: TypedNode<Record<string, unknown>>;
}
interface StripeRetrieveCustomerNode extends StripeNode<"stripe/retrieve_customer"> {
  id: TypedNode<string>;
}
interface StripeUpdateCustomerNode extends StripeNode<"stripe/update_customer"> {
  id: TypedNode<string>;
  params: TypedNode<Record<string, unknown>>;
}
interface StripeListCustomersNode extends StripeNode<"stripe/list_customers"> {}
interface StripeCreateChargeNode extends StripeNode<"stripe/create_charge"> {
  params: TypedNode<Record<string, unknown>>;
}
interface StripeRetrieveChargeNode extends StripeNode<"stripe/retrieve_charge"> {
  id: TypedNode<string>;
}
interface StripeListChargesNode extends StripeNode<"stripe/list_charges"> {}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "stripe/create_payment_intent": StripeCreatePaymentIntentNode;
    "stripe/retrieve_payment_intent": StripeRetrievePaymentIntentNode;
    "stripe/confirm_payment_intent": StripeConfirmPaymentIntentNode;
    "stripe/create_customer": StripeCreateCustomerNode;
    "stripe/retrieve_customer": StripeRetrieveCustomerNode;
    "stripe/update_customer": StripeUpdateCustomerNode;
    "stripe/list_customers": StripeListCustomersNode;
    "stripe/create_charge": StripeCreateChargeNode;
    "stripe/retrieve_charge": StripeRetrieveChargeNode;
    "stripe/list_charges": StripeListChargesNode;
  }
}

/**
 * Creates an interpreter for `stripe/*` node kinds.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns An Interpreter handling all stripe node kinds.
 */
export function createStripeInterpreter(client: StripeClient): Interpreter {
  return typedInterpreter<
    | "stripe/create_payment_intent"
    | "stripe/retrieve_payment_intent"
    | "stripe/confirm_payment_intent"
    | "stripe/create_customer"
    | "stripe/retrieve_customer"
    | "stripe/update_customer"
    | "stripe/list_customers"
    | "stripe/create_charge"
    | "stripe/retrieve_charge"
    | "stripe/list_charges"
  >()({
    "stripe/create_payment_intent": async function* (node: StripeCreatePaymentIntentNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/payment_intents", params);
    },

    "stripe/retrieve_payment_intent": async function* (node: StripeRetrievePaymentIntentNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/payment_intents/${id}`);
    },

    "stripe/confirm_payment_intent": async function* (node: StripeConfirmPaymentIntentNode) {
      const id = yield* eval_(node.id!);
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("POST", `/v1/payment_intents/${id}/confirm`, params);
    },

    "stripe/create_customer": async function* (node: StripeCreateCustomerNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/customers", params);
    },

    "stripe/retrieve_customer": async function* (node: StripeRetrieveCustomerNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/customers/${id}`);
    },

    "stripe/update_customer": async function* (node: StripeUpdateCustomerNode) {
      const id = yield* eval_(node.id!);
      const params = yield* eval_(node.params!);
      return await client.request("POST", `/v1/customers/${id}`, params);
    },

    "stripe/list_customers": async function* (node: StripeListCustomersNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/customers", params);
    },

    "stripe/create_charge": async function* (node: StripeCreateChargeNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/charges", params);
    },

    "stripe/retrieve_charge": async function* (node: StripeRetrieveChargeNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/charges/${id}`);
    },

    "stripe/list_charges": async function* (node: StripeListChargesNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/charges", params);
    },
  });
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
            const Stripe = moduleValue.default;
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
