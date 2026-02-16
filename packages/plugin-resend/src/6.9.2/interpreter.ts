import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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
