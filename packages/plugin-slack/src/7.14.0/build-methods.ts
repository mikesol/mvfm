import type { Expr, PluginContext } from "@mvfm/core";
import type { SlackConfig, SlackMethods } from "./types";

export function buildSlackMethods(ctx: PluginContext, config: SlackConfig): SlackMethods {
  const resolveParams = (params: Expr<Record<string, unknown>> | Record<string, unknown>) =>
    ctx.lift(params).__node;

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
          return ctx.expr({ kind: "slack/chat_update", params: resolveParams(params), config });
        },
        delete(params) {
          return ctx.expr({ kind: "slack/chat_delete", params: resolveParams(params), config });
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
          return ctx.expr({ kind: "slack/users_info", params: resolveParams(params), config });
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
          return ctx.expr({ kind: "slack/reactions_add", params: resolveParams(params), config });
        },
        get(params) {
          return ctx.expr({ kind: "slack/reactions_get", params: resolveParams(params), config });
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
          return ctx.expr({ kind: "slack/files_info", params: resolveParams(params), config });
        },
        delete(params) {
          return ctx.expr({ kind: "slack/files_delete", params: resolveParams(params), config });
        },
      },
    },
  };
}
