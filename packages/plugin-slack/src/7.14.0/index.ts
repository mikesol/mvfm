import type { Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { wrapSlackWebClient } from "./client-slack-web-api";
import { buildSlackMethods } from "./generated/build-methods";
import type { SlackClient } from "./generated/interpreter";
import { createSlackInterpreter } from "./generated/interpreter";
import { SLACK_NODE_KINDS } from "./generated/node-kinds";
import type { SlackConfig } from "./generated/types";

export type { SlackClient } from "./generated/interpreter";
export { createSlackInterpreter, NODE_TO_METHOD } from "./generated/interpreter";
export { SLACK_NODE_KINDS } from "./generated/node-kinds";
export type { SlackConfig, SlackMethods } from "./generated/types";

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

// ---- Node kinds (built once, reused) --------------------------------------

/** KindSpec for slack API methods: single params input, unknown output. */
const slackMethodKind: KindSpec<[unknown], unknown> = {
  inputs: [undefined] as [unknown],
  output: undefined as unknown,
};

const slackKinds = Object.fromEntries(
  SLACK_NODE_KINDS.map((k) => [k, slackMethodKind] as const),
) as Record<string, KindSpec<any, any>>;

const slackShapes = Object.fromEntries(SLACK_NODE_KINDS.map((k) => [k, "*" as const])) as Record<
  string,
  "*"
>;

// ---- Plugin factory -------------------------------------------------------

/**
 * Slack plugin factory. Namespace: `slack/`.
 *
 * Creates a plugin that exposes chat, conversations, users, reactions, and files
 * resource methods for building parameterized Slack API call AST nodes.
 *
 * @param config - A {@link SlackConfig} with a token.
 * @returns A unified Plugin for the slack plugin.
 */
export function slack(_config: SlackConfig) {
  return {
    name: "slack" as const,
    ctors: buildSlackMethods(),
    kinds: slackKinds,
    shapes: slackShapes,
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => slackInterpreter,
  } satisfies Plugin;
}
