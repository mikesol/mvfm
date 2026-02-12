import type { PluginContext, PluginDefinition } from "../../core";

export type MonoidMethods = {};

export const monoid: PluginDefinition<MonoidMethods> = {
  name: "monoid",
  nodeKinds: [],
  build(_ctx: PluginContext): MonoidMethods {
    return {};
  },
};
