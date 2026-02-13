import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Stripe client interface consumed by the stripe handler.
 *
 * Abstracts over the actual Stripe SDK so handlers can be
 * tested with mock clients.
 */
export interface StripeClient {
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for stripe plugin nodes.
 *
 * Yields `stripe/api_call` effects for all 10 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Stripe REST API conventions (as defined by stripe-node's StripeResource).
 */
export const stripeInterpreter: InterpreterFragment = {
  pluginName: "stripe",
  canHandle: (node) => node.kind.startsWith("stripe/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Payment Intents ----

      case "stripe/create_payment_intent": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/payment_intents",
          params,
        };
      }

      case "stripe/retrieve_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/payment_intents/${id}`,
        };
      }

      case "stripe/confirm_payment_intent": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: `/v1/payment_intents/${id}/confirm`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      // ---- Customers ----

      case "stripe/create_customer": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/customers",
          params,
        };
      }

      case "stripe/retrieve_customer": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/customers/${id}`,
        };
      }

      case "stripe/update_customer": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: `/v1/customers/${id}`,
          params,
        };
      }

      case "stripe/list_customers": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: "/v1/customers",
          ...(params !== undefined ? { params } : {}),
        };
      }

      // ---- Charges ----

      case "stripe/create_charge": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "POST",
          path: "/v1/charges",
          params,
        };
      }

      case "stripe/retrieve_charge": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: `/v1/charges/${id}`,
        };
      }

      case "stripe/list_charges": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "stripe/api_call",
          method: "GET",
          path: "/v1/charges",
          ...(params !== undefined ? { params } : {}),
        };
      }

      default:
        throw new Error(`Stripe interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
