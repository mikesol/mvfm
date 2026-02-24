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

import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
import { wrapTwilioSdk } from "./client-twilio-sdk";
import { createTwilioInterpreter, type TwilioClient } from "./interpreter";

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

// ---- Constructor builder ----------------------------------

/**
 * Builds the twilio constructor methods using makeCExpr.
 *
 * Constructors use Liftable<T> for object params and string | CExpr<string>
 * for SID params. Validation happens at `app()` time via KindSpec.
 */
function buildTwilioApi() {
  const messages = Object.assign(
    (sid: string | CExpr<string>) => ({
      /** Fetch this message by its SID. */
      fetch(): CExpr<Record<string, unknown>, "twilio/fetch_message", [string | CExpr<string>]> {
        return makeCExpr("twilio/fetch_message", [sid]) as any;
      },
    }),
    {
      /** Send an SMS/MMS message. */
      create(
        params: Liftable<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>, "twilio/create_message", [Liftable<Record<string, unknown>>]> {
        return makeCExpr("twilio/create_message", [params]) as any;
      },
      /** List messages with optional filter params. */
      list(
        ...params: [] | [Liftable<Record<string, unknown>>]
      ): CExpr<Record<string, unknown>, "twilio/list_messages", [] | [Liftable<Record<string, unknown>>]> {
        return makeCExpr("twilio/list_messages", params as unknown[]) as any;
      },
    },
  );

  const calls = Object.assign(
    (sid: string | CExpr<string>) => ({
      /** Fetch this call by its SID. */
      fetch(): CExpr<Record<string, unknown>, "twilio/fetch_call", [string | CExpr<string>]> {
        return makeCExpr("twilio/fetch_call", [sid]) as any;
      },
    }),
    {
      /** Initiate an outbound call. */
      create(
        params: Liftable<Record<string, unknown>>,
      ): CExpr<Record<string, unknown>, "twilio/create_call", [Liftable<Record<string, unknown>>]> {
        return makeCExpr("twilio/create_call", [params]) as any;
      },
      /** List calls with optional filter params. */
      list(
        ...params: [] | [Liftable<Record<string, unknown>>]
      ): CExpr<Record<string, unknown>, "twilio/list_calls", [] | [Liftable<Record<string, unknown>>]> {
        return makeCExpr("twilio/list_calls", params as unknown[]) as any;
      },
    },
  );

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
    kinds: {
      "twilio/create_message": {
        inputs: [undefined as unknown as Record<string, unknown>],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<[Record<string, unknown>], Record<string, unknown>>,
      "twilio/fetch_message": {
        inputs: [""] as [string],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<[string], Record<string, unknown>>,
      "twilio/list_messages": {
        inputs: [] as Record<string, unknown>[],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<Record<string, unknown>[], Record<string, unknown>>,
      "twilio/create_call": {
        inputs: [undefined as unknown as Record<string, unknown>],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<[Record<string, unknown>], Record<string, unknown>>,
      "twilio/fetch_call": {
        inputs: [""] as [string],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<[string], Record<string, unknown>>,
      "twilio/list_calls": {
        inputs: [] as Record<string, unknown>[],
        output: undefined as unknown as Record<string, unknown>,
      } as KindSpec<Record<string, unknown>[], Record<string, unknown>>,
    },
    shapes: {
      "twilio/create_message": "*",
      "twilio/create_call": "*",
      "twilio/list_messages": "*",
      "twilio/list_calls": "*",
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  } satisfies Plugin;
}

/**
 * Alias for {@link twilio}, kept for readability at call sites.
 */
export const twilioPlugin = twilio;
