import type { Expr, PluginContext, PluginDefinition, TypeclassSlot } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * HeytingAlgebra typeclass template — generates and/or/not methods for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface HeytingAlgebraFor<T> {
  /** Logical conjunction (AND). */
  and(a: Expr<T>, b: Expr<T>): Expr<T>;
  /** Logical disjunction (OR). */
  or(a: Expr<T>, b: Expr<T>): Expr<T>;
  /** Logical negation (NOT). */
  not(a: Expr<T>): Expr<T>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    heytingAlgebra: HeytingAlgebraFor<T>;
  }
}

/** Heyting algebra typeclass plugin. Dispatches `and`, `or`, `not` to type-specific implementations. */
export const heytingAlgebra: PluginDefinition<TypeclassSlot<"heytingAlgebra">> = {
  name: "heytingAlgebra",
  nodeKinds: [],
  build(ctx: PluginContext): any {
    const impls = ctx.plugins
      .filter((p) => p.traits?.heytingAlgebra)
      .map((p) => p.traits!.heytingAlgebra!);

    function dispatchBinary(op: string) {
      return (a: any, b: any) => {
        const aNode = ctx.isExpr(a) ? a.__node : ctx.lift(a).__node;
        const bNode = ctx.isExpr(b) ? b.__node : ctx.lift(b).__node;
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
        return ctx.expr({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      and: dispatchBinary("conj"),
      or: dispatchBinary("disj"),
      not(a: any) {
        const aNode = ctx.isExpr(a) ? a.__node : ctx.lift(a).__node;
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
        return ctx.expr({
          kind: impl.nodeKinds.not,
          operand: aNode,
        });
      },
    };
  },
};
