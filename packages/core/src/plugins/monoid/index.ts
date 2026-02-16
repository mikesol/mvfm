import type { PluginContext, PluginDefinition, TypeclassSlot } from "../../core";

/**
 * Monoid typeclass template — extends Semigroup with an identity element for type T.
 * Currently a marker plugin; dispatched through trait implementations.
 */
export interface MonoidFor<_T> {}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    monoid: MonoidFor<T>;
  }
}

/** Monoid typeclass plugin. Enables identity element dispatch for types with registered monoid traits. */
export const monoid: PluginDefinition<TypeclassSlot<"monoid">> = {
  name: "monoid",
  nodeKinds: [],
  defaultInterpreter: {},
  build(_ctx: PluginContext): any {
    return {};
  },
};
