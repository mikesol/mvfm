import type { Expr, PluginContext, PluginDefinition } from "../../core";

export interface NumMethods {
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  neg(a: Expr<number> | number): Expr<number>;
  abs(a: Expr<number> | number): Expr<number>;
  floor(a: Expr<number> | number): Expr<number>;
  ceil(a: Expr<number> | number): Expr<number>;
  round(a: Expr<number> | number): Expr<number>;
  min(...values: (Expr<number> | number)[]): Expr<number>;
  max(...values: (Expr<number> | number)[]): Expr<number>;
}

export const num: PluginDefinition<NumMethods> = {
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
  traits: {
    eq: { type: "number", nodeKinds: { eq: "num/eq" } },
    ord: { type: "number", nodeKinds: { compare: "num/compare" } },
    semiring: {
      type: "number",
      nodeKinds: { add: "num/add", zero: "num/zero", mul: "num/mul", one: "num/one" },
    },
    show: { type: "number", nodeKinds: { show: "num/show" } },
    bounded: { type: "number", nodeKinds: { top: "num/top", bottom: "num/bottom" } },
  },
  build(ctx: PluginContext): NumMethods {
    const binop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<number>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    const unop = (kind: string) => (a: Expr<number> | number) =>
      ctx.expr<number>({ kind, operand: ctx.lift(a).__node });

    return {
      sub: binop("num/sub"),
      div: binop("num/div"),
      mod: binop("num/mod"),
      neg: unop("num/neg"),
      abs: unop("num/abs"),
      floor: unop("num/floor"),
      ceil: unop("num/ceil"),
      round: unop("num/round"),
      min: (...values) =>
        ctx.expr<number>({
          kind: "num/min",
          values: values.map((v) => ctx.lift(v).__node),
        }),
      max: (...values) =>
        ctx.expr<number>({
          kind: "num/max",
          values: values.map((v) => ctx.lift(v).__node),
        }),
    };
  },
};
