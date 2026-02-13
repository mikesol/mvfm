import type { PluginContext, PluginDefinition } from "../../core";

/** Bounded typeclass plugin — marker plugin that enables `top` and `bottom` dispatch for types with registered bounded traits. */
export type BoundedMethods = {};

/** Bounded typeclass plugin. No direct methods; dispatched through trait implementations registered by type plugins (e.g. `num`, `boolean`). */
export const bounded: PluginDefinition<BoundedMethods> = {
  name: "bounded",
  nodeKinds: [],
  build(_ctx: PluginContext): BoundedMethods {
    return {};
  },
};
