import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";
import { inferType } from "../../trait-utils";
import { eqInterpreter } from "./interpreter";

/**
 * Eq typeclass template — generates eq/neq methods for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface EqFor<T> {
  /** Test structural equality of two values. */
  eq(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
  /** Test structural inequality (negated eq). */
  neq(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    eq: EqFor<T>;
  }
}

/**
 * Equality typeclass plugin. Namespace: `eq/`.
 *
 * Dispatches `eq` and `neq` to the appropriate type-specific implementation
 * based on runtime type inference.
 */
export const eq = definePlugin({
  name: "eq",
  nodeKinds: ["eq/neq"],
  defaultInterpreter: eqInterpreter,
  build(ctx: PluginContext): any {
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
    };
  },
});
