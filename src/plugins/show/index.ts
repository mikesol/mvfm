import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface ShowMethods {
  show(a: Expr<number> | number): Expr<string>;
  show(a: Expr<string> | string): Expr<string>;
  show(a: Expr<boolean> | boolean): Expr<string>;
}

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
