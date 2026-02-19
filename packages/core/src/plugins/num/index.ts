/**
 * DAG-model num plugin definition.
 *
 * Provides the plugin definition with nodeKinds, defaultInterpreter,
 * and build() method that returns num-specific CExpr builders.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createNumDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type N = CExpr<number, string, unknown>;

/** Builder methods contributed by the num plugin to the $ object. */
export interface NumDollar {
  num: {
    literal: (value: number) => N;
    add: (a: N, b: N) => N;
    sub: (a: N, b: N) => N;
    mul: (a: N, b: N) => N;
    div: (a: N, b: N) => N;
    mod: (a: N, b: N) => N;
    compare: (a: N, b: N) => N;
    neg: (a: N) => N;
    abs: (a: N) => N;
    floor: (a: N) => N;
    ceil: (a: N) => N;
    round: (a: N) => N;
    min: (...values: N[]) => N;
    max: (...values: N[]) => N;
    eq: (a: N, b: N) => CExpr<boolean, string, unknown>;
    zero: () => N;
    one: () => N;
    show: (a: N) => CExpr<string, string, unknown>;
    top: () => N;
    bottom: () => N;
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
        literal: (value: number) => ctx.core.literal(value),
        add: (a: N, b: N) => ctx.node("num/add", [a, b]),
        sub: (a: N, b: N) => ctx.node("num/sub", [a, b]),
        mul: (a: N, b: N) => ctx.node("num/mul", [a, b]),
        div: (a: N, b: N) => ctx.node("num/div", [a, b]),
        mod: (a: N, b: N) => ctx.node("num/mod", [a, b]),
        compare: (a: N, b: N) => ctx.node("num/compare", [a, b]),
        neg: (a: N) => ctx.node("num/neg", [a]),
        abs: (a: N) => ctx.node("num/abs", [a]),
        floor: (a: N) => ctx.node("num/floor", [a]),
        ceil: (a: N) => ctx.node("num/ceil", [a]),
        round: (a: N) => ctx.node("num/round", [a]),
        min: (...values: N[]) => ctx.node("num/min", values),
        max: (...values: N[]) => ctx.node("num/max", values),
        eq: (a: N, b: N) => ctx.node("num/eq", [a, b]),
        zero: () => ctx.node("num/zero", []),
        one: () => ctx.node("num/one", []),
        show: (a: N) => ctx.node("num/show", [a]),
        top: () => ctx.node("num/top", []),
        bottom: () => ctx.node("num/bottom", []),
      },
    };
  },
};
