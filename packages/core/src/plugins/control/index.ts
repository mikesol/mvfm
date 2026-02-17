import type { Expr, PluginContext } from "../../core";
import { definePlugin } from "../../core";
import { controlInterpreter } from "./interpreter";

/**
 * Control flow operations for iteration.
 */
export interface ControlMethods {
  /**
   * Iterate over each element of a collection, executing side effects.
   *
   * @param collection - The array expression to iterate.
   * @param body - Callback receiving each element as an `Expr<T>`.
   */
  each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void): void;
  /**
   * Loop while a condition is true.
   *
   * @param condition - Boolean expression to evaluate each iteration.
   * @returns A builder with a `body` method for the loop statements.
   */
  while(condition: Expr<boolean>): {
    body: (...statements: unknown[]) => void;
  };
}

/**
 * Control flow plugin. Namespace: `control/`.
 *
 * Provides `each` for collection iteration and `while` for conditional loops.
 */
export const control = definePlugin({
  name: "control",
  nodeKinds: ["control/each", "control/while"],
  defaultInterpreter: () => controlInterpreter,
  build(ctx: PluginContext): ControlMethods {
    return {
      each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void) {
        const paramNode: any = { kind: "core/lambda_param", name: "item" };
        const paramProxy = ctx.expr<T>(paramNode) as Expr<T>;
        const prevLen = ctx.statements.length;
        body(paramProxy);
        const bodyStatements = ctx.statements.splice(prevLen);
        ctx.emit({
          kind: "control/each",
          collection: collection.__node,
          param: paramNode,
          body: bodyStatements,
        });
      },

      while(condition: Expr<boolean>) {
        return {
          body: (...stmts: unknown[]) => {
            ctx.emit({
              kind: "control/while",
              condition: condition.__node,
              body: stmts.filter((s) => ctx.isExpr(s)).map((s) => (s as Expr<unknown>).__node),
            });
          },
        };
      },
    };
  },
});
