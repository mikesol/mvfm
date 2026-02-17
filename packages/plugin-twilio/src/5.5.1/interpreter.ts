import type { Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";
import { wrapTwilioSdk } from "./client-twilio-sdk";
import type {
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
} from "./types";

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

type TwilioKind =
  | "twilio/create_message"
  | "twilio/fetch_message"
  | "twilio/list_messages"
  | "twilio/create_call"
  | "twilio/fetch_call"
  | "twilio/list_calls";

interface TwilioNode<K extends TwilioKind = TwilioKind> extends TypedNode<unknown> {
  kind: K;
  config: { accountSid: string; authToken: string };
}

export interface TwilioCreateMessageNode extends TwilioNode<"twilio/create_message"> {
  params: TypedNode<MessageListInstanceCreateOptions>;
}

export interface TwilioFetchMessageNode extends TwilioNode<"twilio/fetch_message"> {
  sid: TypedNode<string>;
}

export interface TwilioListMessagesNode extends TwilioNode<"twilio/list_messages"> {
  params?: TypedNode<MessageListInstanceOptions> | null;
}

export interface TwilioCreateCallNode extends TwilioNode<"twilio/create_call"> {
  params: TypedNode<CallListInstanceCreateOptions>;
}

export interface TwilioFetchCallNode extends TwilioNode<"twilio/fetch_call"> {
  sid: TypedNode<string>;
}

export interface TwilioListCallsNode extends TwilioNode<"twilio/list_calls"> {
  params?: TypedNode<CallListInstanceOptions> | null;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "twilio/create_message": TwilioCreateMessageNode;
    "twilio/fetch_message": TwilioFetchMessageNode;
    "twilio/list_messages": TwilioListMessagesNode;
    "twilio/create_call": TwilioCreateCallNode;
    "twilio/fetch_call": TwilioFetchCallNode;
    "twilio/list_calls": TwilioListCallsNode;
  }
}

/**
 * Creates an interpreter for `twilio/*` node kinds.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @returns An Interpreter handling all twilio node kinds.
 */
export function createTwilioInterpreter(client: TwilioClient): Interpreter {
  return defineInterpreter<TwilioKind>()({
    "twilio/create_message": async function* (node: TwilioCreateMessageNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params);
      return await client.request(
        "POST",
        `${base}/Messages.json`,
        params as unknown as Record<string, unknown>,
      );
    },

    "twilio/fetch_message": async function* (node: TwilioFetchMessageNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid);
      return await client.request("GET", `${base}/Messages/${sid}.json`);
    },

    "twilio/list_messages": async function* (node: TwilioListMessagesNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request(
        "GET",
        `${base}/Messages.json`,
        params as unknown as Record<string, unknown> | undefined,
      );
    },

    "twilio/create_call": async function* (node: TwilioCreateCallNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = yield* eval_(node.params);
      return await client.request(
        "POST",
        `${base}/Calls.json`,
        params as unknown as Record<string, unknown>,
      );
    },

    "twilio/fetch_call": async function* (node: TwilioFetchCallNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const sid = yield* eval_(node.sid);
      return await client.request("GET", `${base}/Calls/${sid}.json`);
    },

    "twilio/list_calls": async function* (node: TwilioListCallsNode) {
      const base = `/2010-04-01/Accounts/${node.config.accountSid}`;
      const params = node.params != null ? yield* eval_(node.params) : undefined;
      return await client.request(
        "GET",
        `${base}/Calls.json`,
        params as unknown as Record<string, unknown> | undefined,
      );
    },
  });
}

function requiredEnv(name: "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-twilio: missing ${name}. Set ${name} or use createTwilioInterpreter(...)`,
    );
  }
  return value;
}

function createDefaultTwilioClient(): unknown {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  return {
    async request(opts: {
      method: string;
      uri: string;
      data?: Record<string, unknown>;
    }): Promise<{ body: unknown }> {
      const encodedAuth = btoa(`${accountSid}:${authToken}`);
      const response = await fetch(opts.uri, {
        method: opts.method,
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body:
          opts.data == null
            ? undefined
            : new URLSearchParams(
                Object.entries(opts.data).map(([key, value]) => [key, String(value)]),
              ).toString(),
      });
      return { body: await response.json() };
    },
  };
}

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
 * Default Twilio interpreter that uses `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
 */
export const twilioInterpreter: Interpreter = lazyInterpreter(() =>
  createTwilioInterpreter(wrapTwilioSdk(createDefaultTwilioClient() as any)),
);
