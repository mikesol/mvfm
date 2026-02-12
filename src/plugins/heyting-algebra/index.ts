import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

export interface HeytingAlgebraMethods {
  and(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  or(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  not(a: Expr<boolean>): Expr<boolean>;
}

export const heytingAlgebra: PluginDefinition<HeytingAlgebraMethods> = {
  name: "heytingAlgebra",
  nodeKinds: [],
  build(ctx: PluginContext): HeytingAlgebraMethods {
    const impls = ctx.plugins
      .filter((p) => p.traits?.heytingAlgebra)
      .map((p) => p.traits!.heytingAlgebra!);

    function dispatchBinary(op: string) {
      return (a: Expr<boolean>, b: Expr<boolean>): Expr<boolean> => {
        const aNode = a.__node;
        const bNode = b.__node;
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
              ? `No heytingAlgebra implementation for type: ${type}`
              : `Cannot infer type for ${op} — both arguments are untyped`,
          );
        }
        return ctx.expr<boolean>({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      and: dispatchBinary("conj"),
      or: dispatchBinary("disj"),
      not(a: Expr<boolean>): Expr<boolean> {
        const aNode = a.__node;
        const type = inferType(aNode, impls, ctx.inputSchema);
        const impl = type
          ? impls.find((i) => i.type === type)
          : impls.length === 1
            ? impls[0]
            : undefined;
        if (!impl) {
          throw new Error(
            type
              ? `No heytingAlgebra implementation for type: ${type}`
              : "Cannot infer type for not — argument is untyped",
          );
        }
        return ctx.expr<boolean>({
          kind: impl.nodeKinds.not,
          operand: aNode,
        });
      },
    };
  },
};
