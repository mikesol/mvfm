import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface SemiringMethods {
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
}

export const semiring: PluginDefinition<SemiringMethods> = {
  name: "semiring",
  nodeKinds: [],
  build(ctx: PluginContext): SemiringMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.semiring).map((p) => p.traits!.semiring!);

    function dispatch(op: string) {
      return (a: any, b: any): Expr<number> => {
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
              ? `No semiring implementation for type: ${type}`
              : `Cannot infer type for ${op} — both arguments are untyped`,
          );
        }
        return ctx.expr<number>({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      add: dispatch("add"),
      mul: dispatch("mul"),
    } as SemiringMethods;
  },
};
