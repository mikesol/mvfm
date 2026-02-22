import type { Interpreter, KindSpec } from "@mvfm/core";
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

// ---- Node kinds with record/array ----------------------------------------

const ALL_NODE_KINDS = [...SLACK_NODE_KINDS, "slack/record", "slack/array"] as const;

function buildKinds(): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const kind of ALL_NODE_KINDS) {
    kinds[kind] = {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>;
  }
  return kinds;
}

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
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds: [...ALL_NODE_KINDS],
    defaultInterpreter: (): Interpreter => slackInterpreter,
  };
}
