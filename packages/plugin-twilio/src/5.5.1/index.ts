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
// Not modeled (AST mismatch): auto-pagination, webhooks, TwiML, real-time call control.
//
// Remaining (same CRUD pattern): messages update/remove, calls update,
// Verify, Lookups, Conversations, Sync, Studio, and 20+ other domains.
// Add node kinds + TwilioMethods entries + interpreter cases; no arch changes needed.
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
import type {
  CallInstance,
  CallListInstanceCreateOptions,
  CallListInstanceOptions,
  MessageInstance,
  MessageListInstanceCreateOptions,
  MessageListInstanceOptions,
} from "./types";

// ---- What the plugin adds to $ ----------------------------

/** Context returned by `$.twilio.messages(sid)` — mirrors twilio-node's MessageContext. */
export interface TwilioMessageContext {
  /** Fetch this message by its SID. */
  fetch(): Expr<MessageInstance>;
}

/** Context returned by `$.twilio.calls(sid)` — mirrors twilio-node's CallContext. */
export interface TwilioCallContext {
  /** Fetch this call by its SID. */
  fetch(): Expr<CallInstance>;
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
    params: Expr<MessageListInstanceCreateOptions> | MessageListInstanceCreateOptions,
  ): Expr<MessageInstance>;
  /** List messages with optional filter params. */
  list(
    params?: Expr<MessageListInstanceOptions> | MessageListInstanceOptions,
  ): Expr<MessageInstance[]>;
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
    params: Expr<CallListInstanceCreateOptions> | CallListInstanceCreateOptions,
  ): Expr<CallInstance>;
  /** List calls with optional filter params. */
  list(params?: Expr<CallListInstanceOptions> | CallListInstanceOptions): Expr<CallInstance[]>;
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

      type TwilioParams =
        | MessageListInstanceCreateOptions
        | MessageListInstanceOptions
        | CallListInstanceCreateOptions
        | CallListInstanceOptions;

      function resolveParams(params: Expr<TwilioParams> | TwilioParams) {
        return ctx.lift(params).__node;
      }

      // Build messages resource: callable + .create() + .list()
      // Mirrors twilio-node: client.messages(sid).fetch() AND client.messages.create(...)
      const messages = Object.assign(
        (sid: Expr<string> | string): TwilioMessageContext => ({
          fetch() {
            return ctx.expr<MessageInstance>({
              kind: "twilio/fetch_message",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(
            params: Expr<MessageListInstanceCreateOptions> | MessageListInstanceCreateOptions,
          ) {
            return ctx.expr<MessageInstance>({
              kind: "twilio/create_message",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<MessageListInstanceOptions> | MessageListInstanceOptions) {
            return ctx.expr<MessageInstance[]>({
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
            return ctx.expr<CallInstance>({
              kind: "twilio/fetch_call",
              sid: resolveSid(sid),
              config,
            });
          },
        }),
        {
          create(params: Expr<CallListInstanceCreateOptions> | CallListInstanceCreateOptions) {
            return ctx.expr<CallInstance>({
              kind: "twilio/create_call",
              params: resolveParams(params),
              config,
            });
          },
          list(params?: Expr<CallListInstanceOptions> | CallListInstanceOptions) {
            return ctx.expr<CallInstance[]>({
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

// What works well: CRUD (create/fetch/list) is near-1:1 with twilio-node,
// parameterized ops via proxy chains, callable resource pattern (messages(sid).fetch()),
// and SDK return types (MessageInstance, CallInstance) for IDE autocomplete.
// What doesn't: auto-pagination (async iterators), webhooks (push), TwiML (XML).
