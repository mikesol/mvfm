import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";
import { numInterpreter } from "./interpreter";

/**
 * Numeric operations beyond what the semiring typeclass provides.
 *
 * Includes subtraction, division, modular arithmetic, rounding, and min/max.
 * All methods accept raw numbers or `Expr<number>` (auto-lifted).
 */
export interface NumMethods {
  /** Subtract two numbers. */
  sub(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Divide two numbers. */
  div(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Modulo (remainder) of two numbers. */
  mod(a: Expr<number> | number, b: Expr<number> | number): Expr<number>;
  /** Negate a number. */
  neg(a: Expr<number> | number): Expr<number>;
  /** Absolute value. */
  abs(a: Expr<number> | number): Expr<number>;
  /** Round down to nearest integer. */
  floor(a: Expr<number> | number): Expr<number>;
  /** Round up to nearest integer. */
  ceil(a: Expr<number> | number): Expr<number>;
  /** Round to nearest integer. */
  round(a: Expr<number> | number): Expr<number>;
  /** Minimum of one or more numbers. */
  min(...values: (Expr<number> | number)[]): Expr<number>;
  /** Maximum of one or more numbers. */
  max(...values: (Expr<number> | number)[]): Expr<number>;
}

/**
 * Numeric operations plugin. Namespace: `num/`.
 *
 * Provides arithmetic beyond semiring (sub, div, mod), rounding, and
 * min/max. Also registers trait implementations for eq, ord, semiring,
 * show, and bounded.
 */
export const num = definePlugin({
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
  defaultInterpreter: () => numInterpreter,
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
});
