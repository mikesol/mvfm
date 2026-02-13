import type { Expr, PluginContext, PluginDefinition } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * Semiring typeclass operations providing addition and multiplication.
 */
export interface SemiringMethods {
  /** Add two values via the semiring typeclass. */
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Multiply two values via the semiring typeclass. */
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
}

/** Semiring typeclass plugin. Dispatches `add` and `mul` to type-specific implementations. */
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
