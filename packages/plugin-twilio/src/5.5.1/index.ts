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

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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
 * Builds the twilio constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildTwilioApi() {
  const messages = Object.assign(
    <A>(sid: A) => ({
      /** Fetch this message by its SID. */
      fetch(): CExpr<Record<string, unknown>, "twilio/fetch_message", [A]> {
        return mk("twilio/fetch_message", [sid]);
      },
    }),
    {
      /** Send an SMS/MMS message. */
      create<A>(params: A): CExpr<Record<string, unknown>, "twilio/create_message", [A]> {
        return mk("twilio/create_message", [liftArg(params)]);
      },
      /** List messages with optional filter params. */
      list<A>(params?: A): CExpr<Record<string, unknown>, "twilio/list_messages", [A]> {
        if (params == null) {
          return mk("twilio/list_messages", []);
        }
        return mk("twilio/list_messages", [liftArg(params)]);
      },
    },
  );

  const calls = Object.assign(
    <A>(sid: A) => ({
      /** Fetch this call by its SID. */
      fetch(): CExpr<Record<string, unknown>, "twilio/fetch_call", [A]> {
        return mk("twilio/fetch_call", [sid]);
      },
    }),
    {
      /** Initiate an outbound call. */
      create<A>(params: A): CExpr<Record<string, unknown>, "twilio/create_call", [A]> {
        return mk("twilio/create_call", [liftArg(params)]);
      },
      /** List calls with optional filter params. */
      list<A>(params?: A): CExpr<Record<string, unknown>, "twilio/list_calls", [A]> {
        if (params == null) {
          return mk("twilio/list_calls", []);
        }
        return mk("twilio/list_calls", [liftArg(params)]);
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
