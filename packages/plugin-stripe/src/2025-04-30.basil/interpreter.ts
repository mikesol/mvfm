import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface StripeNode extends TypedNode<unknown> {
  kind: string;
  id?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
}

/**
 * Creates an interpreter for `stripe/*` node kinds.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns An Interpreter handling all stripe node kinds.
 */
export function createStripeInterpreter(client: StripeClient): Interpreter {
  return {
    "stripe/create_payment_intent": async function* (node: StripeNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/payment_intents", params);
    },

    "stripe/retrieve_payment_intent": async function* (node: StripeNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/payment_intents/${id}`);
    },

    "stripe/confirm_payment_intent": async function* (node: StripeNode) {
      const id = yield* eval_(node.id!);
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("POST", `/v1/payment_intents/${id}/confirm`, params);
    },

    "stripe/create_customer": async function* (node: StripeNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/customers", params);
    },

    "stripe/retrieve_customer": async function* (node: StripeNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/customers/${id}`);
    },

    "stripe/update_customer": async function* (node: StripeNode) {
      const id = yield* eval_(node.id!);
      const params = yield* eval_(node.params!);
      return await client.request("POST", `/v1/customers/${id}`, params);
    },

    "stripe/list_customers": async function* (node: StripeNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/customers", params);
    },

    "stripe/create_charge": async function* (node: StripeNode) {
      const params = yield* eval_(node.params!);
      return await client.request("POST", "/v1/charges", params);
    },

    "stripe/retrieve_charge": async function* (node: StripeNode) {
      const id = yield* eval_(node.id!);
      return await client.request("GET", `/v1/charges/${id}`);
    },

    "stripe/list_charges": async function* (node: StripeNode) {
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", "/v1/charges", params);
    },
  };
}
