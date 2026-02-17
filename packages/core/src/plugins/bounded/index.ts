import type { PluginContext } from "../../core";
import { definePlugin } from "../../core";

/**
 * Bounded typeclass template — placeholder for future top/bottom methods for type T.
 * Currently a marker plugin; dispatched through trait implementations
 * registered by type plugins (e.g. `num`, `boolean`).
 */
export interface BoundedFor<_T> {}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    bounded: BoundedFor<T>;
  }
}

/** Bounded typeclass plugin. No direct methods; dispatched through trait implementations registered by type plugins (e.g. `num`, `boolean`). */
export const bounded = definePlugin({
  name: "bounded",
  nodeKinds: [],
  build(_ctx: PluginContext): any {
    return {};
  },
});
