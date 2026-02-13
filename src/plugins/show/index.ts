import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * Show typeclass operations for converting values to their string representation.
 */
export interface ShowMethods {
  /** Convert a value to its string representation via the Show typeclass. */
  show(a: Expr<number> | number): Expr<string>;
  /** Convert a value to its string representation via the Show typeclass. */
  show(a: Expr<string> | string): Expr<string>;
  /** Convert a value to its string representation via the Show typeclass. */
  show(a: Expr<boolean> | boolean): Expr<string>;
}

/** Show typeclass plugin. Dispatches to type-specific `show` implementations. */
export const show: PluginDefinition<ShowMethods> = {
  name: "show",
  nodeKinds: [],
  build(ctx: PluginContext): ShowMethods {
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
    } as ShowMethods;
  },
};
