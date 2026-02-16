import type { Expr, PluginContext, PluginDefinition, TypeclassSlot } from "../../core";
import { inferType } from "../../trait-utils";
import { ordInterpreter } from "./interpreter";

/**
 * Ord typeclass template — generates comparison methods for a specific type T.
 * Resolved by MergePlugins based on which type plugins are loaded.
 */
export interface OrdFor<T> {
  /** Three-way comparison returning -1, 0, or 1. */
  compare(a: Expr<T> | T, b: Expr<T> | T): Expr<number>;
  /** Greater than. */
  gt(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
  /** Greater than or equal. */
  gte(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
  /** Less than. */
  lt(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
  /** Less than or equal. */
  lte(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;
}

// Register with the typeclass mapping
declare module "../../core" {
  interface TypeclassMapping<T> {
    ord: OrdFor<T>;
  }
}

/**
 * Ordering typeclass plugin. Namespace: `ord/`.
 *
 * Dispatches comparisons to type-specific implementations. Derives
 * `gt`, `gte`, `lt`, `lte` from the base `compare` operation.
 */
export const ord: PluginDefinition<TypeclassSlot<"ord">> = {
  name: "ord",
  nodeKinds: ["ord/gt", "ord/gte", "ord/lt", "ord/lte"],
  defaultInterpreter: ordInterpreter,
  build(ctx: PluginContext): any {
    const impls = ctx.plugins.filter((p) => p.traits?.ord).map((p) => p.traits!.ord!);

    function dispatchCompare(a: any, b: any): Expr<number> {
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
            ? `No ord implementation for type: ${type}`
            : "Cannot infer type for compare — both arguments are untyped",
        );
      }
      return ctx.expr<number>({
        kind: impl.nodeKinds.compare,
        left: aNode,
        right: bNode,
      });
    }

    function derived(op: "ord/gt" | "ord/gte" | "ord/lt" | "ord/lte") {
      return (a: any, b: any): Expr<boolean> => {
        const compareNode = dispatchCompare(a, b).__node;
        return ctx.expr<boolean>({ kind: op, operand: compareNode });
      };
    }

    return {
      compare: dispatchCompare,
      gt: derived("ord/gt"),
      gte: derived("ord/gte"),
      lt: derived("ord/lt"),
      lte: derived("ord/lte"),
    };
  },
};
