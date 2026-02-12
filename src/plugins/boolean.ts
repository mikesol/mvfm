import type { Expr, PluginContext, PluginDefinition } from "../core";

export interface BooleanMethods {
  and(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  or(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  not(a: Expr<boolean>): Expr<boolean>;
}

export const boolean: PluginDefinition<BooleanMethods> = {
  name: "boolean",
  nodeKinds: ["boolean/and", "boolean/or", "boolean/not"],
  build(ctx: PluginContext): BooleanMethods {
    return {
      and(a, b) {
        return ctx.expr<boolean>({ kind: "boolean/and", left: a.__node, right: b.__node });
      },
      or(a, b) {
        return ctx.expr<boolean>({ kind: "boolean/or", left: a.__node, right: b.__node });
      },
      not(a) {
        return ctx.expr<boolean>({ kind: "boolean/not", operand: a.__node });
      },
    };
  },
};
