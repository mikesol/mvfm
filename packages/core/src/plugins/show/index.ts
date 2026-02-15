import type { Expr, PluginContext, PluginDefinition, TypeclassSlot } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * Show typeclass template — generates show method for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface ShowFor<T> {
  /** Convert a value to its string representation via the Show typeclass. */
  show(a: Expr<T> | T): Expr<string>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    show: ShowFor<T>;
  }
}

/** Show typeclass plugin. Dispatches to type-specific `show` implementations. */
export const show: PluginDefinition<TypeclassSlot<"show">> = {
  name: "show",
  nodeKinds: [],
  build(ctx: PluginContext): any {
    const impls = ctx.plugins.filter((p) => p.traits?.show).map((p) => p.traits!.show!);

    return {
      show(a: any): Expr<string> {
        const aNode = ctx.lift(a).__node;
        const type = inferType(aNode, impls, ctx.inputSchema);
        const impl = type
          ? impls.find((i) => i.type === type)
          : impls.length === 1
            ? impls[0]
            : undefined;
        if (!impl) {
          throw new Error(
            type
              ? `No show implementation for type: ${type}`
              : "Cannot infer type for show — argument is untyped",
          );
        }
        return ctx.expr<string>({
          kind: impl.nodeKinds.show,
          operand: aNode,
        });
      },
    };
  },
};
