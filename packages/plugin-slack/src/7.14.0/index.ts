import { definePlugin } from "@mvfm/core";
import { buildSlackMethods } from "./build-methods";
import { slackInterpreter } from "./interpreter";
import { SLACK_NODE_KINDS } from "./node-kinds";
import type { SlackConfig } from "./types";

export type { SlackConfig, SlackMethods } from "./types";

/**
 * Slack plugin factory. Namespace: `slack/`.
 *
 * Creates a plugin that exposes chat, conversations, users, reactions, and files
 * resource methods for building parameterized Slack API call AST nodes.
 *
 * @param config - A {@link SlackConfig} with a token.
 * @returns A PluginDefinition for the slack plugin.
 */
export function slack(config: SlackConfig) {
  return definePlugin({
    name: "slack",
    nodeKinds: [...SLACK_NODE_KINDS],
    defaultInterpreter: () => slackInterpreter,
    build(ctx) {
      return buildSlackMethods(ctx, config);
    },
  });
}
