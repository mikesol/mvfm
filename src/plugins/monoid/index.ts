import type { PluginContext, PluginDefinition } from "../../core";

/** Monoid typeclass plugin — extends Semigroup with an identity element. No direct methods; dispatched through trait implementations. */
export type MonoidMethods = {};

/** Monoid typeclass plugin. Enables identity element dispatch for types with registered monoid traits. */
export const monoid: PluginDefinition<MonoidMethods> = {
  name: "monoid",
  nodeKinds: [],
  build(_ctx: PluginContext): MonoidMethods {
    return {};
  },
};
