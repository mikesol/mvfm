import type { Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";
import { wrapSlackWebClient } from "./client-slack-web-api";
import type { SLACK_NODE_KINDS } from "./node-kinds";

/**
 * Abstract Slack client interface consumed by the slack handler.
 *
 * Abstracts over the actual `@slack/web-api` `WebClient` so handlers
 * can be tested with mock clients. Mirrors the `WebClient.apiCall()`
 * signature.
 */
export interface SlackClient {
  /** Execute a Slack API request and return the parsed response. */
  apiCall(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Map from AST node kind to Slack API method string.
 *
 * Covers all 25 node kinds across 5 resource groups:
 * chat (6), conversations (8), users (4), reactions (4), files (3).
 */
const NODE_TO_METHOD: Record<string, string> = {
  "slack/chat_postMessage": "chat.postMessage",
  "slack/chat_update": "chat.update",
  "slack/chat_delete": "chat.delete",
  "slack/chat_postEphemeral": "chat.postEphemeral",
  "slack/chat_scheduleMessage": "chat.scheduleMessage",
  "slack/chat_getPermalink": "chat.getPermalink",
  "slack/conversations_list": "conversations.list",
  "slack/conversations_info": "conversations.info",
  "slack/conversations_create": "conversations.create",
  "slack/conversations_invite": "conversations.invite",
  "slack/conversations_history": "conversations.history",
  "slack/conversations_members": "conversations.members",
  "slack/conversations_open": "conversations.open",
  "slack/conversations_replies": "conversations.replies",
  "slack/users_info": "users.info",
  "slack/users_list": "users.list",
  "slack/users_lookupByEmail": "users.lookupByEmail",
  "slack/users_conversations": "users.conversations",
  "slack/reactions_add": "reactions.add",
  "slack/reactions_get": "reactions.get",
  "slack/reactions_list": "reactions.list",
  "slack/reactions_remove": "reactions.remove",
  "slack/files_list": "files.list",
  "slack/files_info": "files.info",
  "slack/files_delete": "files.delete",
};

type SlackKind = (typeof SLACK_NODE_KINDS)[number];

interface SlackNode<K extends SlackKind = SlackKind> extends TypedNode<unknown> {
  kind: K;
  params?: TypedNode<Record<string, unknown>> | null;
  config: { token: string };
}

export interface SlackChatPostMessageNode extends SlackNode<"slack/chat_postMessage"> {}
export interface SlackChatUpdateNode extends SlackNode<"slack/chat_update"> {}
export interface SlackChatDeleteNode extends SlackNode<"slack/chat_delete"> {}
export interface SlackChatPostEphemeralNode extends SlackNode<"slack/chat_postEphemeral"> {}
export interface SlackChatScheduleMessageNode extends SlackNode<"slack/chat_scheduleMessage"> {}
export interface SlackChatGetPermalinkNode extends SlackNode<"slack/chat_getPermalink"> {}
export interface SlackConversationsListNode extends SlackNode<"slack/conversations_list"> {}
export interface SlackConversationsInfoNode extends SlackNode<"slack/conversations_info"> {}
export interface SlackConversationsCreateNode extends SlackNode<"slack/conversations_create"> {}
export interface SlackConversationsInviteNode extends SlackNode<"slack/conversations_invite"> {}
export interface SlackConversationsHistoryNode extends SlackNode<"slack/conversations_history"> {}
export interface SlackConversationsMembersNode extends SlackNode<"slack/conversations_members"> {}
export interface SlackConversationsOpenNode extends SlackNode<"slack/conversations_open"> {}
export interface SlackConversationsRepliesNode extends SlackNode<"slack/conversations_replies"> {}
export interface SlackUsersInfoNode extends SlackNode<"slack/users_info"> {}
export interface SlackUsersListNode extends SlackNode<"slack/users_list"> {}
export interface SlackUsersLookupByEmailNode extends SlackNode<"slack/users_lookupByEmail"> {}
export interface SlackUsersConversationsNode extends SlackNode<"slack/users_conversations"> {}
export interface SlackReactionsAddNode extends SlackNode<"slack/reactions_add"> {}
export interface SlackReactionsGetNode extends SlackNode<"slack/reactions_get"> {}
export interface SlackReactionsListNode extends SlackNode<"slack/reactions_list"> {}
export interface SlackReactionsRemoveNode extends SlackNode<"slack/reactions_remove"> {}
export interface SlackFilesListNode extends SlackNode<"slack/files_list"> {}
export interface SlackFilesInfoNode extends SlackNode<"slack/files_info"> {}
export interface SlackFilesDeleteNode extends SlackNode<"slack/files_delete"> {}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "slack/chat_postMessage": SlackChatPostMessageNode;
    "slack/chat_update": SlackChatUpdateNode;
    "slack/chat_delete": SlackChatDeleteNode;
    "slack/chat_postEphemeral": SlackChatPostEphemeralNode;
    "slack/chat_scheduleMessage": SlackChatScheduleMessageNode;
    "slack/chat_getPermalink": SlackChatGetPermalinkNode;
    "slack/conversations_list": SlackConversationsListNode;
    "slack/conversations_info": SlackConversationsInfoNode;
    "slack/conversations_create": SlackConversationsCreateNode;
    "slack/conversations_invite": SlackConversationsInviteNode;
    "slack/conversations_history": SlackConversationsHistoryNode;
    "slack/conversations_members": SlackConversationsMembersNode;
    "slack/conversations_open": SlackConversationsOpenNode;
    "slack/conversations_replies": SlackConversationsRepliesNode;
    "slack/users_info": SlackUsersInfoNode;
    "slack/users_list": SlackUsersListNode;
    "slack/users_lookupByEmail": SlackUsersLookupByEmailNode;
    "slack/users_conversations": SlackUsersConversationsNode;
    "slack/reactions_add": SlackReactionsAddNode;
    "slack/reactions_get": SlackReactionsGetNode;
    "slack/reactions_list": SlackReactionsListNode;
    "slack/reactions_remove": SlackReactionsRemoveNode;
    "slack/files_list": SlackFilesListNode;
    "slack/files_info": SlackFilesInfoNode;
    "slack/files_delete": SlackFilesDeleteNode;
  }
}

/**
 * Creates an interpreter for `slack/*` node kinds.
 *
 * All 25 methods follow the same uniform pattern: look up the API method,
 * resolve params, and call `client.apiCall()`.
 *
 * @param client - The {@link SlackClient} to execute against.
 * @returns An Interpreter handling all slack node kinds.
 */
export function createSlackInterpreter(client: SlackClient): Interpreter {
  const handler = async function* (node: SlackNode) {
    const method = NODE_TO_METHOD[node.kind];
    if (!method) throw new Error(`Slack interpreter: unknown node kind "${node.kind}"`);
    const params = node.params != null ? yield* eval_(node.params) : undefined;
    return await client.apiCall(method, params);
  };

  return defineInterpreter<SlackKind>()({
    "slack/chat_postMessage": async function* (node: SlackChatPostMessageNode) {
      return yield* handler(node);
    },
    "slack/chat_update": async function* (node: SlackChatUpdateNode) {
      return yield* handler(node);
    },
    "slack/chat_delete": async function* (node: SlackChatDeleteNode) {
      return yield* handler(node);
    },
    "slack/chat_postEphemeral": async function* (node: SlackChatPostEphemeralNode) {
      return yield* handler(node);
    },
    "slack/chat_scheduleMessage": async function* (node: SlackChatScheduleMessageNode) {
      return yield* handler(node);
    },
    "slack/chat_getPermalink": async function* (node: SlackChatGetPermalinkNode) {
      return yield* handler(node);
    },
    "slack/conversations_list": async function* (node: SlackConversationsListNode) {
      return yield* handler(node);
    },
    "slack/conversations_info": async function* (node: SlackConversationsInfoNode) {
      return yield* handler(node);
    },
    "slack/conversations_create": async function* (node: SlackConversationsCreateNode) {
      return yield* handler(node);
    },
    "slack/conversations_invite": async function* (node: SlackConversationsInviteNode) {
      return yield* handler(node);
    },
    "slack/conversations_history": async function* (node: SlackConversationsHistoryNode) {
      return yield* handler(node);
    },
    "slack/conversations_members": async function* (node: SlackConversationsMembersNode) {
      return yield* handler(node);
    },
    "slack/conversations_open": async function* (node: SlackConversationsOpenNode) {
      return yield* handler(node);
    },
    "slack/conversations_replies": async function* (node: SlackConversationsRepliesNode) {
      return yield* handler(node);
    },
    "slack/users_info": async function* (node: SlackUsersInfoNode) {
      return yield* handler(node);
    },
    "slack/users_list": async function* (node: SlackUsersListNode) {
      return yield* handler(node);
    },
    "slack/users_lookupByEmail": async function* (node: SlackUsersLookupByEmailNode) {
      return yield* handler(node);
    },
    "slack/users_conversations": async function* (node: SlackUsersConversationsNode) {
      return yield* handler(node);
    },
    "slack/reactions_add": async function* (node: SlackReactionsAddNode) {
      return yield* handler(node);
    },
    "slack/reactions_get": async function* (node: SlackReactionsGetNode) {
      return yield* handler(node);
    },
    "slack/reactions_list": async function* (node: SlackReactionsListNode) {
      return yield* handler(node);
    },
    "slack/reactions_remove": async function* (node: SlackReactionsRemoveNode) {
      return yield* handler(node);
    },
    "slack/files_list": async function* (node: SlackFilesListNode) {
      return yield* handler(node);
    },
    "slack/files_info": async function* (node: SlackFilesInfoNode) {
      return yield* handler(node);
    },
    "slack/files_delete": async function* (node: SlackFilesDeleteNode) {
      return yield* handler(node);
    },
  });
}

function requiredEnv(name: "SLACK_BOT_TOKEN"): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const value = env?.[name];
  if (!value) {
    throw new Error(
      `@mvfm/plugin-slack: missing ${name}. Set ${name} or use createSlackInterpreter(...)`,
    );
  }
  return value;
}

const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<any>;

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
 * Default Slack interpreter that uses `SLACK_BOT_TOKEN`.
 */
export const slackInterpreter: Interpreter = lazyInterpreter(() =>
  createSlackInterpreter(
    (() => {
      let clientPromise: Promise<SlackClient> | undefined;
      const getClient = async (): Promise<SlackClient> => {
        if (!clientPromise) {
          const token = requiredEnv("SLACK_BOT_TOKEN");
          clientPromise = dynamicImport("@slack/web-api").then((moduleValue) => {
            const WebClient = moduleValue.WebClient;
            return wrapSlackWebClient(new WebClient(token));
          });
        }
        return clientPromise;
      };

      return {
        async apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
          const client = await getClient();
          return client.apiCall(method, params);
        },
      } satisfies SlackClient;
    })(),
  ),
);
