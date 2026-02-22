// ============================================================
// MVFM PLUGIN: twilio (twilio-node compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - Messages: create, fetch, list
//   - Calls: create, fetch, list
// ============================================================

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapTwilioSdk } from "./client-twilio-sdk";
import { createTwilioInterpreter, type TwilioClient } from "./interpreter";

// ---- liftArg: recursive plain-value → CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `twilio/record` CExprs with key-value child pairs.
 * - Arrays become `twilio/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("twilio/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("twilio/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/** Context returned by `$.twilio.messages(sid)` — mirrors twilio-node's MessageContext. */
export interface TwilioMessageContext {
  /** Fetch this message by its SID. */
  fetch(): CExpr<Record<string, unknown>>;
}

/** Context returned by `$.twilio.calls(sid)` — mirrors twilio-node's CallContext. */
export interface TwilioCallContext {
  /** Fetch this call by its SID. */
  fetch(): CExpr<Record<string, unknown>>;
}

/**
 * The messages resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.messages.create(...)` and `client.messages(sid).fetch()`.
 */
export interface TwilioMessagesResource {
  /** Get a message context by SID (for .fetch()). */
  (sid: string | CExpr<string>): TwilioMessageContext;
  /** Send an SMS/MMS message. */
  create(
    params: Record<string, unknown> | CExpr<Record<string, unknown>>,
  ): CExpr<Record<string, unknown>>;
  /** List messages with optional filter params. */
  list(
    params?: Record<string, unknown> | CExpr<Record<string, unknown>>,
  ): CExpr<Record<string, unknown>>;
}

/**
 * The calls resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.calls.create(...)` and `client.calls(sid).fetch()`.
 */
export interface TwilioCallsResource {
  /** Get a call context by SID (for .fetch()). */
  (sid: string | CExpr<string>): TwilioCallContext;
  /** Initiate an outbound call. */
  create(
    params: Record<string, unknown> | CExpr<Record<string, unknown>>,
  ): CExpr<Record<string, unknown>>;
  /** List calls with optional filter params. */
  list(
    params?: Record<string, unknown> | CExpr<Record<string, unknown>>,
  ): CExpr<Record<string, unknown>>;
}

/**
 * Twilio operations added to the DSL context by the twilio plugin.
 *
 * Mirrors the twilio-node SDK resource API: messages and calls.
 * Each resource exposes create/fetch/list methods that produce
 * CExpr nodes.
 */
export interface TwilioMethods {
  /** Twilio API operations, namespaced under `$.twilio`. */
  twilio: {
    /** Messages resource. Callable: `messages(sid).fetch()`, or `messages.create(...)`. */
    messages: TwilioMessagesResource;
    /** Calls resource. Callable: `calls(sid).fetch()`, or `calls.create(...)`. */
    calls: TwilioCallsResource;
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the twilio plugin.
 *
 * Requires accountSid and authToken for Basic auth against
 * the Twilio REST API.
 */
export interface TwilioConfig {
  /** Twilio Account SID (e.g. `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`). */
  accountSid: string;
  /** Twilio Auth Token. */
  authToken: string;
}

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
    "twilio/create_message": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "twilio/fetch_message": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "twilio/list_messages": {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>,
    "twilio/create_call": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "twilio/fetch_call": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "twilio/list_calls": {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>,
    "twilio/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "twilio/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}

// ---- Constructor builder ----------------------------------

function buildTwilioApi(): TwilioMethods["twilio"] {
  const messages = Object.assign(
    (sid: string | CExpr<string>): TwilioMessageContext => ({
      fetch() {
        return makeCExpr("twilio/fetch_message", [sid]);
      },
    }),
    {
      create(params: Record<string, unknown> | CExpr<Record<string, unknown>>) {
        return makeCExpr("twilio/create_message", [liftArg(params)]);
      },
      list(params?: Record<string, unknown> | CExpr<Record<string, unknown>>) {
        if (params == null) {
          return makeCExpr("twilio/list_messages", []);
        }
        return makeCExpr("twilio/list_messages", [liftArg(params)]);
      },
    },
  ) as unknown as TwilioMessagesResource;

  const calls = Object.assign(
    (sid: string | CExpr<string>): TwilioCallContext => ({
      fetch() {
        return makeCExpr("twilio/fetch_call", [sid]);
      },
    }),
    {
      create(params: Record<string, unknown> | CExpr<Record<string, unknown>>) {
        return makeCExpr("twilio/create_call", [liftArg(params)]);
      },
      list(params?: Record<string, unknown> | CExpr<Record<string, unknown>>) {
        if (params == null) {
          return makeCExpr("twilio/list_calls", []);
        }
        return makeCExpr("twilio/list_calls", [liftArg(params)]);
      },
    },
  ) as unknown as TwilioCallsResource;

  return { messages, calls };
}

// ---- Default interpreter wiring ---------------------------

function createDefaultInterpreter(config: TwilioConfig): Interpreter {
  let clientPromise: Promise<TwilioClient> | undefined;
  const getClient = async (): Promise<TwilioClient> => {
    if (!clientPromise) {
      clientPromise = Promise.resolve(wrapTwilioSdk(createDefaultTwilioSdkClient(config)));
    }
    return clientPromise;
  };

  const lazyClient: TwilioClient = {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, params);
    },
  };

  return createTwilioInterpreter(lazyClient, config.accountSid);
}

function createDefaultTwilioSdkClient(config: TwilioConfig): {
  request(opts: {
    method: string;
    uri: string;
    data?: Record<string, unknown>;
  }): Promise<{ body: unknown }>;
} {
  return {
    async request(opts) {
      const encodedAuth = btoa(`${config.accountSid}:${config.authToken}`);
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

// ---- Plugin factory ---------------------------------------

/**
 * Creates the twilio plugin definition (unified Plugin type).
 *
 * @param config - A {@link TwilioConfig} with accountSid and authToken.
 * @returns A unified Plugin that contributes `$.twilio`.
 */
export function twilio(config: TwilioConfig) {
  return {
    name: "twilio" as const,
    ctors: { twilio: buildTwilioApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  };
}

/**
 * Alias for {@link twilio}, kept for readability at call sites.
 */
export const twilioPlugin = twilio;
