// ============================================================
// MVFM PLUGIN: slack (@slack/web-api compatible API)
// ============================================================
//
// Implementation status: PARTIAL (5 of 30+ resource groups)
// Plugin size: LARGE — at pass 1 of 60/30/10 split (5 of 30+ groups)
//
// Implemented:
//   - chat: postMessage, update, delete, postEphemeral, scheduleMessage, getPermalink
//   - conversations: list, info, create, invite, history, members, open, replies
//   - users: info, list, lookupByEmail, conversations
//   - reactions: add, get, list, remove
//   - files: list, info, delete
//
// Not doable (fundamental mismatch with AST model):
//   - Auto-pagination: conversations.list etc. return paginated results
//     with cursor. Returns first page only; use $.rec() for full pagination.
//   - File uploads: files.uploadV2 makes 3 internal API calls.
//     Not a single AST node.
//   - Real-time events (RTM, Socket Mode): Push-based, not request-response.
//   - Streaming (chat.startStream, chat.appendStream): Stateful streaming protocol.
//   - Block Kit composition: No special AST support — blocks are plain
//     JSON objects, handled by ctx.lift().
//
// Remaining (same apiCall pattern, add as needed):
//   admin, bookmarks, pins, reminders, views, search, team, dnd,
//   emoji, usergroups, apps, auth, bots, calls, canvases, dialog,
//   functions, migration, oauth, openid, rtm, stars, tooling, workflows.
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to SlackMethods, add entries to the interpreter
//   NODE_TO_METHOD map. The interpreter/handler architecture does
//   not need to change — slack/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows @slack/web-api should be able to write
// Mvfm programs with near-zero learning curve. The API should
// look like the real @slack/web-api SDK as closely as possible.
//
// Real @slack/web-api API (v7.14.0):
//   const client = new WebClient('xoxb-...')
//   const result = await client.chat.postMessage({ channel: '#general', text: 'Hello' })
//   const result = await client.conversations.list({ limit: 100 })
//   const result = await client.users.lookupByEmail({ email: 'user@example.com' })
//   const result = await client.reactions.add({ channel: 'C123', timestamp: '123.456', name: 'thumbsup' })
//   const result = await client.files.list({ channel: 'C123' })
//
// Based on source-level analysis of @slack/web-api@7.14.0
// (github.com/slackapi/node-slack-sdk). Every method in WebClient
// is bindApiCall(this, 'method.name') → delegates to
// apiCall(method, options). apiCall sends
// POST https://slack.com/api/{method} with form-encoded body.
// Pure request-response. No state, no scoping, no transactions.
// 275 methods total. All follow the same pattern.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Slack operations added to the DSL context by the slack plugin.
 *
 * Mirrors the `@slack/web-api` SDK resource API: chat, conversations,
 * users, reactions, and files. Each resource group exposes methods
 * that produce namespaced AST nodes.
 */
export interface SlackMethods {
  /** Slack API operations, namespaced under `$.slack`. */
  slack: {
    /** Chat messaging operations. */
    chat: {
      /** Send a message to a channel. */
      postMessage(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Update an existing message. */
      update(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Delete a message. */
      delete(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Send an ephemeral message visible only to one user. */
      postEphemeral(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Schedule a message to be sent at a future time. */
      scheduleMessage(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get a permanent URL for a message. */
      getPermalink(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    /** Conversation (channel/DM/group) operations. */
    conversations: {
      /** List conversations the bot is a member of. Params are optional. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get info about a conversation. */
      info(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Create a new conversation (channel). */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Invite users to a conversation. */
      invite(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Fetch message history for a conversation. */
      history(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** List members of a conversation. */
      members(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Open or resume a direct message or multi-person DM. */
      open(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Retrieve a thread of messages posted to a conversation. */
      replies(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    /** User operations. */
    users: {
      /** Get info about a user. */
      info(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** List all users in the workspace. Params are optional. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Find a user by email address. */
      lookupByEmail(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** List conversations a user is a member of. */
      conversations(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    /** Emoji reaction operations. */
    reactions: {
      /** Add a reaction to a message. */
      add(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get reactions for a message. */
      get(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** List reactions made by a user. Params are optional. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Remove a reaction from a message. */
      remove(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    /** File operations. */
    files: {
      /** List files. Params are optional. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Get info about a file. */
      info(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Delete a file. */
      delete(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the slack plugin.
 *
 * Requires a bot or user token (`xoxb-...` or `xoxp-...`).
 */
export interface SlackConfig {
  /** Slack bot or user token (e.g. `xoxb-...` or `xoxp-...`). */
  token: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Slack plugin factory. Namespace: `slack/`.
 *
 * Creates a plugin that exposes chat, conversations, users, reactions, and files
 * resource methods for building parameterized Slack API call AST nodes.
 *
 * @param config - A {@link SlackConfig} with a token.
 * @returns A PluginDefinition for the slack plugin.
 */
export function slack(config: SlackConfig): PluginDefinition<SlackMethods> {
  return {
    name: "slack",
    nodeKinds: [
      "slack/chat_postMessage",
      "slack/chat_update",
      "slack/chat_delete",
      "slack/chat_postEphemeral",
      "slack/chat_scheduleMessage",
      "slack/chat_getPermalink",
      "slack/conversations_list",
      "slack/conversations_info",
      "slack/conversations_create",
      "slack/conversations_invite",
      "slack/conversations_history",
      "slack/conversations_members",
      "slack/conversations_open",
      "slack/conversations_replies",
      "slack/users_info",
      "slack/users_list",
      "slack/users_lookupByEmail",
      "slack/users_conversations",
      "slack/reactions_add",
      "slack/reactions_get",
      "slack/reactions_list",
      "slack/reactions_remove",
      "slack/files_list",
      "slack/files_info",
      "slack/files_delete",
    ],

    build(ctx: PluginContext): SlackMethods {
      // Helper: resolve a params object to an AST node.
      // ctx.lift handles both Expr and raw objects (lifts to core/record).
      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      return {
        slack: {
          chat: {
            postMessage(params) {
              return ctx.expr({
                kind: "slack/chat_postMessage",
                params: resolveParams(params),
                config,
              });
            },
            update(params) {
              return ctx.expr({
                kind: "slack/chat_update",
                params: resolveParams(params),
                config,
              });
            },
            delete(params) {
              return ctx.expr({
                kind: "slack/chat_delete",
                params: resolveParams(params),
                config,
              });
            },
            postEphemeral(params) {
              return ctx.expr({
                kind: "slack/chat_postEphemeral",
                params: resolveParams(params),
                config,
              });
            },
            scheduleMessage(params) {
              return ctx.expr({
                kind: "slack/chat_scheduleMessage",
                params: resolveParams(params),
                config,
              });
            },
            getPermalink(params) {
              return ctx.expr({
                kind: "slack/chat_getPermalink",
                params: resolveParams(params),
                config,
              });
            },
          },

          conversations: {
            list(params?) {
              return ctx.expr({
                kind: "slack/conversations_list",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
            info(params) {
              return ctx.expr({
                kind: "slack/conversations_info",
                params: resolveParams(params),
                config,
              });
            },
            create(params) {
              return ctx.expr({
                kind: "slack/conversations_create",
                params: resolveParams(params),
                config,
              });
            },
            invite(params) {
              return ctx.expr({
                kind: "slack/conversations_invite",
                params: resolveParams(params),
                config,
              });
            },
            history(params) {
              return ctx.expr({
                kind: "slack/conversations_history",
                params: resolveParams(params),
                config,
              });
            },
            members(params) {
              return ctx.expr({
                kind: "slack/conversations_members",
                params: resolveParams(params),
                config,
              });
            },
            open(params) {
              return ctx.expr({
                kind: "slack/conversations_open",
                params: resolveParams(params),
                config,
              });
            },
            replies(params) {
              return ctx.expr({
                kind: "slack/conversations_replies",
                params: resolveParams(params),
                config,
              });
            },
          },

          users: {
            info(params) {
              return ctx.expr({
                kind: "slack/users_info",
                params: resolveParams(params),
                config,
              });
            },
            list(params?) {
              return ctx.expr({
                kind: "slack/users_list",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
            lookupByEmail(params) {
              return ctx.expr({
                kind: "slack/users_lookupByEmail",
                params: resolveParams(params),
                config,
              });
            },
            conversations(params) {
              return ctx.expr({
                kind: "slack/users_conversations",
                params: resolveParams(params),
                config,
              });
            },
          },

          reactions: {
            add(params) {
              return ctx.expr({
                kind: "slack/reactions_add",
                params: resolveParams(params),
                config,
              });
            },
            get(params) {
              return ctx.expr({
                kind: "slack/reactions_get",
                params: resolveParams(params),
                config,
              });
            },
            list(params?) {
              return ctx.expr({
                kind: "slack/reactions_list",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
            remove(params) {
              return ctx.expr({
                kind: "slack/reactions_remove",
                params: resolveParams(params),
                config,
              });
            },
          },

          files: {
            list(params?) {
              return ctx.expr({
                kind: "slack/files_list",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
            info(params) {
              return ctx.expr({
                kind: "slack/files_info",
                params: resolveParams(params),
                config,
              });
            },
            delete(params) {
              return ctx.expr({
                kind: "slack/files_delete",
                params: resolveParams(params),
                config,
              });
            },
          },
        },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic API calls:
//    Real:  const result = await client.chat.postMessage({ channel: '#general', text: 'Hello' })
//    Mvfm:   const result = $.slack.chat.postMessage({ channel: '#general', text: 'Hello' })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const user = $.slack.users.lookupByEmail({ email: $.input.userEmail })
//    const msg = $.slack.chat.postMessage({ channel: '#general', text: 'Hello', user: user.user.id })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  client.chat.postMessage(...)
//    Mvfm:   $.slack.chat.postMessage(...)
//    The nested resource pattern maps 1:1. An LLM that knows
//    @slack/web-api can write Mvfm Slack programs immediately.
//
// 4. Optional params:
//    Real:  await client.conversations.list()
//    Mvfm:   $.slack.conversations.list()
//    Both work. The AST stores null for omitted optional params.
//
// WORKS BUT DIFFERENT:
//
// 5. Return types:
//    Real @slack/web-api has typed response interfaces
//    (ChatPostMessageResponse, ConversationsListResponse, etc.)
//    with precise field definitions.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (result.ts, result.channel),
//    but there's no IDE autocomplete for Slack-specific fields.
//    A future enhancement could add typed response interfaces.
//
// 6. Sequencing side effects:
//    Real:  await client.chat.postMessage(...)
//           await client.reactions.add(...)
//    Mvfm:   const msg = $.slack.chat.postMessage(...)
//           const reaction = $.slack.reactions.add({ timestamp: msg.ts, ... })
//           return $.discard(msg, reaction)
//    Must use $.discard() for sequencing when there are data dependencies.
//    Without data dependency, $.discard() is required to avoid orphan errors.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Auto-pagination:
//    Real:  Paginated results with response_metadata.next_cursor
//    Mvfm:   Returns first page only. For full pagination, use
//           $.rec() with cursor logic.
//
// 8. File uploads:
//    Real:  client.files.uploadV2({ channel_id, file, filename })
//    Mvfm:   Not modeled. files.uploadV2 makes 3 internal API calls
//           (getUploadURLExternal, upload, completeUploadExternal).
//           Not a single AST node.
//
// 9. Real-time events (RTM, Socket Mode):
//    Push-based, not request-response. Belong in the
//    interpreter/runtime layer, not in the AST.
//
// 10. Streaming (chat.startStream, chat.appendStream):
//    Stateful streaming protocol. Not modelable as single
//    request-response AST nodes.
//
// 11. Block Kit composition:
//    No special AST support — blocks are plain JSON objects,
//    handled by ctx.lift(). Works fine for static blocks;
//    dynamic blocks use proxy values naturally.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of @slack/web-api@7.14.0
// (github.com/slackapi/node-slack-sdk). Every method in WebClient
// is bindApiCall(this, 'method.name') → delegates to
// apiCall(method, options). Pure request-response.
//
// For the core 80% use case of "call a Slack API method with
// params and get a response" — this is nearly identical to
// real @slack/web-api. Resource nesting (chat, conversations,
// users, reactions, files) maps 1:1. Proxy chains capture
// cross-operation dependencies perfectly.
//
// The main gap is typed response objects — we use
// Record<string, unknown> instead of ChatPostMessageResponse etc.
// This means no autocomplete on response fields, but property
// access still works at runtime via proxy.
//
// Not supported: auto-pagination, file uploads, real-time events,
// streaming, admin operations. These are either runtime concerns
// (RTM, Socket Mode) or could be added incrementally
// (pagination via $.rec, admin methods in future passes).
// ============================================================
