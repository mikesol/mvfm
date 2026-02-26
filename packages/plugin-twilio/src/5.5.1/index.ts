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

import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

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
      ): CExpr<
        Record<string, unknown>,
        "twilio/create_message",
        [Liftable<Record<string, unknown>>]
      > {
        return makeCExpr("twilio/create_message", [params]) as any;
      },
      /** List messages with optional filter params. */
      list(
        ...params: [] | [Liftable<Record<string, unknown>>]
      ): CExpr<
        Record<string, unknown>,
        "twilio/list_messages",
        [] | [Liftable<Record<string, unknown>>]
      > {
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
      ): CExpr<
        Record<string, unknown>,
        "twilio/list_calls",
        [] | [Liftable<Record<string, unknown>>]
      > {
        return makeCExpr("twilio/list_calls", params as unknown[]) as any;
      },
    },
  );

  return { messages, calls };
}

// ---- Plugin definition ------------------------------------

/**
 * The twilio plugin definition (unified Plugin type).
 *
 * Contributes `$.twilio` with messages and calls API.
 * Requires an interpreter provided via
 * `defaults(plugins, { twilio: createTwilioInterpreter(client, accountSid) })`.
 */
export const twilio = {
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
} satisfies Plugin;

/**
 * Alias for {@link twilio}, kept for readability at call sites.
 */
export const twilioPlugin = twilio;
