import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Twilio client interface consumed by the twilio handler.
 *
 * Abstracts over the actual Twilio SDK so handlers can be
 * tested with mock clients.
 */
export interface TwilioClient {
  /** Execute a Twilio API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for twilio plugin nodes.
 *
 * Yields `twilio/api_call` effects for all 6 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Twilio REST API v2010 conventions.
 */
export const twilioInterpreter: InterpreterFragment = {
  pluginName: "twilio",
  canHandle: (node) => node.kind.startsWith("twilio/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const config = node.config as { accountSid: string; authToken: string };
    const base = `/2010-04-01/Accounts/${config.accountSid}`;

    switch (node.kind) {
      // ---- Messages ----

      case "twilio/create_message": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "POST",
          path: `${base}/Messages.json`,
          params,
        };
      }

      case "twilio/fetch_message": {
        const sid = yield { type: "recurse", child: node.sid as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Messages/${sid}.json`,
        };
      }

      case "twilio/list_messages": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Messages.json`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      // ---- Calls ----

      case "twilio/create_call": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "POST",
          path: `${base}/Calls.json`,
          params,
        };
      }

      case "twilio/fetch_call": {
        const sid = yield { type: "recurse", child: node.sid as ASTNode };
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Calls/${sid}.json`,
        };
      }

      case "twilio/list_calls": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "twilio/api_call",
          method: "GET",
          path: `${base}/Calls.json`,
          ...(params !== undefined ? { params } : {}),
        };
      }

      default:
        throw new Error(`Twilio interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
