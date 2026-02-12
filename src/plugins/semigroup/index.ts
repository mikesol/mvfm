import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface SemigroupMethods {
  append(a: Expr<string> | string, b: Expr<string> | string): Expr<string>;
}

export const semigroup: PluginDefinition<SemigroupMethods> = {
  name: "semigroup",
  nodeKinds: [],
  build(ctx: PluginContext): SemigroupMethods {
    const impls = ctx.plugins.filter((p) => p.traits?.semigroup).map((p) => p.traits!.semigroup!);

    return {
      append(a: any, b: any): Expr<string> {
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
        return ctx.expr<string>({
          kind: impl.nodeKinds.append,
          left: aNode,
          right: bNode,
        });
      },
    } as SemigroupMethods;
  },
};
