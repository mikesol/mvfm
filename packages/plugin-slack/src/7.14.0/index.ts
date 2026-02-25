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

const slackKinds = Object.fromEntries([
  ...SLACK_NODE_KINDS.map((k) => [k, slackMethodKind] as const),
  [
    "slack/record",
    {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
  ],
  [
    "slack/array",
    {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  ],
]) as Record<string, KindSpec<any, any>>;

// ---- Plugin factory -------------------------------------------------------

/**
 * Slack plugin definition (unified Plugin type).
 *
 * This plugin has no defaultInterpreter — you must provide one
 * via `defaults(app, { slack: createSlackInterpreter(wrapSlackWebClient(client)) })`.
 */
export const slack = {
  name: "slack" as const,
  ctors: buildSlackMethods(),
  kinds: slackKinds,
  traits: {},
  lifts: {},
} satisfies Plugin;
