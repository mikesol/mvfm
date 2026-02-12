import type { Expr, PluginContext, PluginDefinition } from "../core";

export interface NumMethods {
  add(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mul(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  gt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  gte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lt(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
  lte(a: Expr<number> | number, b: Expr<number> | number): Expr<boolean>;
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
    "num/gt",
    "num/gte",
    "num/lt",
    "num/lte",
    "num/neg",
    "num/abs",
    "num/floor",
    "num/ceil",
    "num/round",
    "num/min",
    "num/max",
    "num/eq",
  ],
  traits: { eq: { type: "number", nodeKind: "num/eq" } },
  build(ctx: PluginContext): NumMethods {
    const binop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<number>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    const unop = (kind: string) => (a: Expr<number> | number) =>
      ctx.expr<number>({ kind, operand: ctx.lift(a).__node });

    const cmpop = (kind: string) => (a: Expr<number> | number, b: Expr<number> | number) =>
      ctx.expr<boolean>({
        kind,
        left: ctx.lift(a).__node,
        right: ctx.lift(b).__node,
      });

    return {
      add: binop("num/add"),
      sub: binop("num/sub"),
      mul: binop("num/mul"),
      div: binop("num/div"),
      mod: binop("num/mod"),
      gt: cmpop("num/gt"),
      gte: cmpop("num/gte"),
      lt: cmpop("num/lt"),
      lte: cmpop("num/lte"),
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
