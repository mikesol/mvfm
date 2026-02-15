import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

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
 * Generator-based interpreter fragment for resend plugin nodes.
 *
 * Yields `resend/api_call` effects for all 7 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Resend REST API conventions (as defined by resend-node v6.9.2).
 */
export const resendInterpreter: InterpreterFragment = {
  pluginName: "resend",
  canHandle: (node) => node.kind.startsWith("resend/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Emails ----

      case "resend/send_email": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/emails",
          params,
        };
      }

      case "resend/get_email": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: `/emails/${id}`,
        };
      }

      // ---- Batch ----

      case "resend/send_batch": {
        const emails = yield { type: "recurse", child: node.emails as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/emails/batch",
          params: emails,
        };
      }

      // ---- Contacts ----

      case "resend/create_contact": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "POST",
          path: "/contacts",
          params,
        };
      }

      case "resend/get_contact": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: `/contacts/${id}`,
        };
      }

      case "resend/list_contacts": {
        return yield {
          type: "resend/api_call",
          method: "GET",
          path: "/contacts",
        };
      }

      case "resend/remove_contact": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "resend/api_call",
          method: "DELETE",
          path: `/contacts/${id}`,
        };
      }

      default:
        throw new Error(`Resend interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
