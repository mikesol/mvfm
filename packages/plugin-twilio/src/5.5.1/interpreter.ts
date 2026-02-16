import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface TwilioNode extends TypedNode<unknown> {
  kind: string;
  sid?: TypedNode<string>;
  params?: TypedNode<Record<string, unknown>>;
  config: { accountSid: string; authToken: string };
}

/**
 * Creates an interpreter for `twilio/*` node kinds.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @returns An Interpreter handling all twilio node kinds.
 */
export function createTwilioInterpreter(client: TwilioClient): Interpreter {
  return {
    "twilio/create_message": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params!);
      return await client.request("POST", `${base}/Messages.json`, params);
    },

    "twilio/fetch_message": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid!);
      return await client.request("GET", `${base}/Messages/${sid}.json`);
    },

    "twilio/list_messages": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", `${base}/Messages.json`, params);
    },

    "twilio/create_call": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params!);
      return await client.request("POST", `${base}/Calls.json`, params);
    },

    "twilio/fetch_call": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid!);
      return await client.request("GET", `${base}/Calls/${sid}.json`);
    },

    "twilio/list_calls": async function* (node: TwilioNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request("GET", `${base}/Calls.json`, params);
    },
  };
}
