import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
import { wrapSlackWebClient } from "./client-slack-web-api";

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

interface SlackNode extends TypedNode<unknown> {
  kind: string;
  params?: TypedNode<Record<string, unknown>>;
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

  return Object.fromEntries(Object.keys(NODE_TO_METHOD).map((kind) => [kind, handler]));
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
