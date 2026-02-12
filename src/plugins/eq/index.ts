import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface EqMethods {
  eq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  eq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  eq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
  neq(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  neq(a: Expr<string> | string, b: Expr<string> | string): Expr<boolean>;
  neq(a: Expr<boolean> | boolean, b: Expr<boolean> | boolean): Expr<boolean>;
}

export const eq: PluginDefinition<EqMethods> = {
  name: "eq",
  nodeKinds: ["eq/neq"],
  build(ctx: PluginContext): EqMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.eq).map((p) => p.traits!.eq!);

    function dispatchEq(a: any, b: any): Expr<boolean> {
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
            ? `No eq implementation for type: ${type}`
            : "Cannot infer type for eq — both arguments are untyped",
        );
      }
      return ctx.expr<boolean>({
        kind: impl.nodeKinds.eq,
        left: aNode,
        right: bNode,
      });
    }

    return {
      eq: dispatchEq,
      neq(a: any, b: any): Expr<boolean> {
        const inner = dispatchEq(a, b);
        return ctx.expr<boolean>({
          kind: "eq/neq",
          inner: inner.__node,
        });
      },
    } as EqMethods;
  },
};
