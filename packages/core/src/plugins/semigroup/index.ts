import type { Expr, PluginContext, PluginDefinition, TypeclassSlot } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * Semigroup typeclass template — generates append method for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface SemigroupFor<T> {
  /** Combine two values using the semigroup's associative operation. */
  append(a: Expr<T> | T, b: Expr<T> | T): Expr<T>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    semigroup: SemigroupFor<T>;
  }
}

/** Semigroup typeclass plugin. Dispatches `append` to type-specific implementations. */
export const semigroup: PluginDefinition<TypeclassSlot<"semigroup">> = {
  name: "semigroup",
  nodeKinds: [],
  defaultInterpreter: {},
  build(ctx: PluginContext): any {
    const impls = ctx.plugins.filter((p) => p.traits?.semigroup).map((p) => p.traits!.semigroup!);

    return {
      append(a: any, b: any) {
        const aNode = ctx.lift(a).__node;
        const bNode = ctx.lift(b).__node;
        const type =
          inferType(aNode, impls, ctx.inputSchema) ?? inferType(bNode, impls, ctx.inputSchema);
        const impl = type
          ? impls.find((i) => i.type === type)
          : impls.length === 1
            ? impls[0]
            : undefined;
        if (!impl) {
          throw new Error(
            type
              ? `No semigroup implementation for type: ${type}`
              : "Cannot infer type for append — both arguments are untyped",
          );
        }
        return ctx.expr({
          kind: impl.nodeKinds.append,
          left: aNode,
          right: bNode,
        });
      },
    };
  },
};
