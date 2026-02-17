import type { Expr } from "@mvfm/core";
import type {
  ChatDeleteArguments,
  ChatDeleteResponse,
  ChatGetPermalinkArguments,
  ChatGetPermalinkResponse,
  ChatPostEphemeralArguments,
  ChatPostEphemeralResponse,
  // Chat
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  ChatScheduleMessageArguments,
  ChatScheduleMessageResponse,
  ChatUpdateArguments,
  ChatUpdateResponse,
  ConversationsCreateArguments,
  ConversationsCreateResponse,
  ConversationsHistoryArguments,
  ConversationsHistoryResponse,
  ConversationsInfoArguments,
  ConversationsInfoResponse,
  ConversationsInviteArguments,
  ConversationsInviteResponse,
  // Conversations
  ConversationsListArguments,
  ConversationsListResponse,
  ConversationsMembersArguments,
  ConversationsMembersResponse,
  ConversationsOpenArguments,
  ConversationsOpenResponse,
  ConversationsRepliesArguments,
  ConversationsRepliesResponse,
  FilesDeleteArguments,
  FilesDeleteResponse,
  FilesInfoArguments,
  FilesInfoResponse,
  // Files
  FilesListArguments,
  FilesListResponse,
  // Reactions
  ReactionsAddArguments,
  ReactionsAddResponse,
  ReactionsGetArguments,
  ReactionsGetResponse,
  ReactionsListArguments,
  ReactionsListResponse,
  ReactionsRemoveArguments,
  ReactionsRemoveResponse,
  UsersConversationsArguments,
  UsersConversationsResponse,
  // Users
  UsersInfoArguments,
  UsersInfoResponse,
  UsersListArguments,
  UsersListResponse,
  UsersLookupByEmailArguments,
  UsersLookupByEmailResponse,
} from "@slack/web-api";

type Primitive = string | number | boolean | null | undefined;

type Exprify<T> = T extends Primitive
  ? T | Expr<T>
  : T extends Array<infer U>
    ? Array<Exprify<U>> | Expr<T>
    : T extends object
      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>
      : T | Expr<T>;

type SlackParams<T> = Exprify<Omit<T, "token">>;

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
      postMessage(params: SlackParams<ChatPostMessageArguments>): Expr<ChatPostMessageResponse>;
      update(params: SlackParams<ChatUpdateArguments>): Expr<ChatUpdateResponse>;
      delete(params: SlackParams<ChatDeleteArguments>): Expr<ChatDeleteResponse>;
      postEphemeral(
        params: SlackParams<ChatPostEphemeralArguments>,
      ): Expr<ChatPostEphemeralResponse>;
      scheduleMessage(
        params: SlackParams<ChatScheduleMessageArguments>,
      ): Expr<ChatScheduleMessageResponse>;
      getPermalink(params: SlackParams<ChatGetPermalinkArguments>): Expr<ChatGetPermalinkResponse>;
    };
    /** Conversation (channel/DM/group) operations. */
    conversations: {
      list(params?: SlackParams<ConversationsListArguments>): Expr<ConversationsListResponse>;
      info(params: SlackParams<ConversationsInfoArguments>): Expr<ConversationsInfoResponse>;
      create(params: SlackParams<ConversationsCreateArguments>): Expr<ConversationsCreateResponse>;
      invite(params: SlackParams<ConversationsInviteArguments>): Expr<ConversationsInviteResponse>;
      history(
        params: SlackParams<ConversationsHistoryArguments>,
      ): Expr<ConversationsHistoryResponse>;
      members(
        params: SlackParams<ConversationsMembersArguments>,
      ): Expr<ConversationsMembersResponse>;
      open(params: SlackParams<ConversationsOpenArguments>): Expr<ConversationsOpenResponse>;
      replies(
        params: SlackParams<ConversationsRepliesArguments>,
      ): Expr<ConversationsRepliesResponse>;
    };
    /** User operations. */
    users: {
      info(params: SlackParams<UsersInfoArguments>): Expr<UsersInfoResponse>;
      list(params?: SlackParams<UsersListArguments>): Expr<UsersListResponse>;
      lookupByEmail(
        params: SlackParams<UsersLookupByEmailArguments>,
      ): Expr<UsersLookupByEmailResponse>;
      conversations(
        params: SlackParams<UsersConversationsArguments>,
      ): Expr<UsersConversationsResponse>;
    };
    /** Emoji reaction operations. */
    reactions: {
      add(params: SlackParams<ReactionsAddArguments>): Expr<ReactionsAddResponse>;
      get(params: SlackParams<ReactionsGetArguments>): Expr<ReactionsGetResponse>;
      list(params?: SlackParams<ReactionsListArguments>): Expr<ReactionsListResponse>;
      remove(params: SlackParams<ReactionsRemoveArguments>): Expr<ReactionsRemoveResponse>;
    };
    /** File operations. */
    files: {
      list(params?: SlackParams<FilesListArguments>): Expr<FilesListResponse>;
      info(params: SlackParams<FilesInfoArguments>): Expr<FilesInfoResponse>;
      delete(params: SlackParams<FilesDeleteArguments>): Expr<FilesDeleteResponse>;
    };
  };
}

/**
 * Configuration for the slack plugin.
 *
 * Requires a bot or user token (`xoxb-...` or `xoxp-...`).
 */
export interface SlackConfig {
  /** Slack bot or user token (e.g. `xoxb-...` or `xoxp-...`). */
  token: string;
}
