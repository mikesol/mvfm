/**
 * DAG-model num plugin definition.
 *
 * Provides the plugin definition with nodeKinds, defaultInterpreter,
 * and build() method that returns num-specific CExpr builders.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createNumDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

/** Builder methods contributed by the num plugin to the $ object. */
export interface NumDollar {
  num: {
    /** Create a numeric literal node. */
    literal: (value: number) => CExpr<number, string, unknown>;
    /** Add two numbers. */
    add: (
      a: CExpr<number, string, unknown>,
      b: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
    /** Subtract b from a. */
    sub: (
      a: CExpr<number, string, unknown>,
      b: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
    /** Multiply two numbers. */
    mul: (
      a: CExpr<number, string, unknown>,
      b: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
    /** Divide a by b. */
    div: (
      a: CExpr<number, string, unknown>,
      b: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
    /** Negate a number. */
    neg: (
      a: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
    /** Absolute value. */
    abs: (
      a: CExpr<number, string, unknown>,
    ) => CExpr<number, string, unknown>;
  };
}

/** DAG-model num plugin definition. */
export const numDagPlugin: PluginDefWithBuild = {
  name: "num",
  nodeKinds: [
    "num/add",
    "num/sub",
    "num/mul",
    "num/div",
    "num/mod",
    "num/compare",
    "num/neg",
    "num/abs",
    "num/floor",
    "num/ceil",
    "num/round",
    "num/min",
    "num/max",
    "num/eq",
    "num/zero",
    "num/one",
    "num/show",
    "num/top",
    "num/bottom",
  ],
  defaultInterpreter: createNumDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      num: {
        literal: (value: number) =>
          ctx.core.literal(value),
        add: (
          a: CExpr<number, string, unknown>,
          b: CExpr<number, string, unknown>,
        ) => ctx.node("num/add", [a, b]),
        sub: (
          a: CExpr<number, string, unknown>,
          b: CExpr<number, string, unknown>,
        ) => ctx.node("num/sub", [a, b]),
        mul: (
          a: CExpr<number, string, unknown>,
          b: CExpr<number, string, unknown>,
        ) => ctx.node("num/mul", [a, b]),
        div: (
          a: CExpr<number, string, unknown>,
          b: CExpr<number, string, unknown>,
        ) => ctx.node("num/div", [a, b]),
        neg: (a: CExpr<number, string, unknown>) =>
          ctx.node("num/neg", [a]),
        abs: (a: CExpr<number, string, unknown>) =>
          ctx.node("num/abs", [a]),
      },
    };
  },
};
