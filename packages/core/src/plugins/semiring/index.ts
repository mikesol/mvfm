import type { Expr, PluginContext, PluginDefinition, TypeclassSlot } from "../../core";
import { inferType } from "../../trait-utils";

/**
 * Semiring typeclass template — generates add/mul methods for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface SemiringFor<T> {
  /** Add two values via the semiring typeclass. */
  add(a: Expr<T> | T, b: Expr<T> | T): Expr<T>;
  /** Multiply two values via the semiring typeclass. */
  mul(a: Expr<T> | T, b: Expr<T> | T): Expr<T>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    semiring: SemiringFor<T>;
  }
}

/** Semiring typeclass plugin. Dispatches `add` and `mul` to type-specific implementations. */
export const semiring: PluginDefinition<TypeclassSlot<"semiring">> = {
  name: "semiring",
  nodeKinds: [],
  defaultInterpreter: {},
  build(ctx: PluginContext): any {
    const impls = ctx.plugins.filter((p) => p.traits?.semiring).map((p) => p.traits!.semiring!);

    function dispatch(op: string) {
      return (a: any, b: any) => {
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
        return ctx.expr({
          kind: impl.nodeKinds[op],
          left: aNode,
          right: bNode,
        });
      };
    }

    return {
      add: dispatch("add"),
      mul: dispatch("mul"),
    };
  },
};
