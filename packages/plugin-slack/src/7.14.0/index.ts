import type { KindSpec, Plugin } from "@mvfm/core";
import { buildSlackMethods } from "./generated/build-methods";
import { SLACK_NODE_KINDS } from "./generated/node-kinds";

export type { SlackClient } from "./generated/interpreter";
export { createSlackInterpreter, NODE_TO_METHOD } from "./generated/interpreter";
export { SLACK_NODE_KINDS } from "./generated/node-kinds";
export type { SlackConfig, SlackMethods } from "./generated/types";

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

// ---- Plugin definition -------------------------------------------------------

/**
 * The slack plugin definition (unified Plugin type).
 *
 * Contributes chat, conversations, users, reactions, and files
 * resource methods for building parameterized Slack API call AST nodes.
 *
 * Requires an interpreter provided via
 * `defaults(plugins, { slack: createSlackInterpreter(client) })`.
 */
export const slack = {
  name: "slack" as const,
  ctors: buildSlackMethods(),
  kinds: slackKinds,
  shapes: slackShapes,
  traits: {},
  lifts: {},
} satisfies Plugin;
