import type { PluginContext, PluginDefinition } from "../../core";

export type BoundedMethods = {};

export const bounded: PluginDefinition<BoundedMethods> = {
  name: "bounded",
  nodeKinds: [],
  build(_ctx: PluginContext): BoundedMethods {
    return {};
  },
};
