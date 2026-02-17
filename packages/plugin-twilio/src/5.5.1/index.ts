// ============================================================
// MVFM PLUGIN: twilio (twilio-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (2 of 30+ service domains)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (2 of 30+ domains)
//
// Implemented:
//   - Messages: create, fetch, list
//   - Calls: create, fetch, list
//
// Not doable (fundamental mismatch with AST model):
//   - Auto-pagination (each() with async iterator — push-based)
//   - Webhooks / status callbacks (server-initiated push)
//   - TwiML generation (XML construction, not REST API)
//   - Real-time call control (stateful, TwiML-driven)
//
// Remaining (same REST pattern, add as needed):
//   Messages: update (cancel), remove
//   Calls: update (modify in-progress)
//   Verify: services, verifications, verification checks
//   Lookups: phone number lookup
//   Conversations, Sync, Studio, and 20+ other service domains
//
//   Each resource follows the same CRUD pattern: add node kinds,
//   add methods to TwilioMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — twilio/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows twilio-node should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real twilio-node SDK as closely as possible.
//
// Real twilio-node API (v5.5.1):
//   const client = require('twilio')(accountSid, authToken)
//   const msg = await client.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//   const msg = await client.messages('SM123').fetch()
//   const msgs = await client.messages.list({ limit: 10 })
//   const call = await client.calls.create({ to: '+1...', from: '+1...', url: 'https://...' })
//   const call = await client.calls('CA123').fetch()
//   const calls = await client.calls.list({ limit: 20 })
//
// Based on source-level analysis of twilio-node
// (github.com/twilio/twilio-node, tag 5.5.1). The SDK is
// auto-generated from OpenAPI specs. Each resource lives under
// src/rest/api/v2010/account/ with ListInstance (create, list)
// and Context (fetch, update, remove) patterns. All operations
// are REST request-response over https://api.twilio.com with
// Basic auth (accountSid:authToken).
//
// ============================================================

import type { Expr, PluginContext } from "@mvfm/core";
import { definePlugin } from "@mvfm/core";
import { twilioInterpreter } from "./interpreter";

// ---- What the plugin adds to $ ----------------------------

/** Context returned by `$.twilio.messages(sid)` — mirrors twilio-node's MessageContext. */
export interface TwilioMessageContext {
  /** Fetch this message by its SID. */
  fetch(): Expr<Record<string, unknown>>;
}

/** Context returned by `$.twilio.calls(sid)` — mirrors twilio-node's CallContext. */
export interface TwilioCallContext {
  /** Fetch this call by its SID. */
  fetch(): Expr<Record<string, unknown>>;
}

/**
 * The messages resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.messages.create(...)` and `client.messages(sid).fetch()`.
 */
export interface TwilioMessagesResource {
  /** Get a message context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioMessageContext;
  /** Send an SMS/MMS message. */
  create(
    params: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
  /** List messages with optional filter params. */
  list(
    params?: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
}

/**
 * The calls resource — callable to get a context, with create/list methods.
 * Mirrors twilio-node: `client.calls.create(...)` and `client.calls(sid).fetch()`.
 */
export interface TwilioCallsResource {
  /** Get a call context by SID (for .fetch()). */
  (sid: Expr<string> | string): TwilioCallContext;
  /** Initiate an outbound call. */
  create(
    params: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
  /** List calls with optional filter params. */
  list(
    params?: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): Expr<Record<string, unknown>>;
}

/**
 * Twilio operations added to the DSL context by the twilio plugin.
 *
 * Mirrors the twilio-node SDK resource API: messages and calls.
 * Each resource exposes create/fetch/list methods that produce
 * namespaced AST nodes.
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

// ---- Plugin implementation --------------------------------

/**
 * Twilio plugin factory. Namespace: `twilio/`.
 *
 * Creates a plugin that exposes messages and calls resource methods
 * for building parameterized Twilio API call AST nodes.
 *
 * @param config - A {@link TwilioConfig} with accountSid and authToken.
 * @returns A PluginDefinition for the twilio plugin.
 */
export function twilio(config: TwilioConfig) {
  return definePlugin({
    name: "twilio",
    nodeKinds: [
      "twilio/create_message",
      "twilio/fetch_message",
      "twilio/list_messages",
      "twilio/create_call",
      "twilio/fetch_call",
      "twilio/list_calls",
    ],
    defaultInterpreter: twilioInterpreter,

    build(ctx: PluginContext): TwilioMethods {
      function resolveSid(sid: Expr<string> | string) {
        return ctx.isExpr(sid) ? sid.__node : ctx.lift(sid).__node;
      }

      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      // Build messages resource: callable + .create() + .list()
      // Mirrors twilio-node: client.messages(sid).fetch() AND client.messages.create(...)
      const messages = Object.assign(
        (sid: Expr<string> | string): TwilioMessageContext => ({
          fetch() {
            return ctx.expr({
              kind: "twilio/fetch_message",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/create_message",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/list_messages",
              params: params != null ? resolveParams(params) : null,
              config,
            });
          },
        },
      ) as TwilioMessagesResource;

      // Build calls resource: same pattern
      const calls = Object.assign(
        (sid: Expr<string> | string): TwilioCallContext => ({
          fetch() {
            return ctx.expr({
              kind: "twilio/fetch_call",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/create_call",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<Record<string, unknown>> | Record<string, unknown>) {
            return ctx.expr({
              kind: "twilio/list_calls",
              params: params != null ? resolveParams(params) : null,
              config,
            });
          },
        },
      ) as TwilioCallsResource;

      return {
        twilio: { messages, calls },
      };
    },
  });
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic CRUD operations:
//    Real:  const msg = await client.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//    Mvfm:   const msg = $.twilio.messages.create({ to: '+1...', from: '+1...', body: 'Hello' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const msg = $.twilio.messages.create({ to: $.input.to, body: $.input.body })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  client.messages.create(...)
//    Mvfm:   $.twilio.messages.create(...)
//    The nested resource pattern maps 1:1.
//
// WORKS GREAT (cont.):
//
// 4. Fetch by SID:
//    Real:  client.messages('SM123').fetch()
//    Mvfm:   $.twilio.messages('SM123').fetch()
//    1:1 match. Uses Object.assign to make messages both callable
//    and have .create()/.list() properties, just like twilio-node.
//
// 5. Return types:
//    Real twilio-node has typed response classes (MessageInstance,
//    CallInstance, etc.) with properties like .sid, .status, .body.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (msg.sid, call.status),
//    but no IDE autocomplete for Twilio-specific fields.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Auto-pagination:
//    Real:  client.messages.each({ pageSize: 20 }, (msg) => { ... })
//    Mvfm:   Can't model async iterators/callbacks.
//
// 7. Webhooks / status callbacks:
//    Server-initiated push events, not request/response.
//
// 8. TwiML generation:
//    XML construction — separate concern from REST API calls.
//
// ============================================================
