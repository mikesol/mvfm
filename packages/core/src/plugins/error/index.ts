/**
 * DAG-model error plugin definition.
 *
 * Provides try/catch, fail, attempt, guard, settle for error handling.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createErrorDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model error plugin definition. */
export const errorDagPlugin: PluginDefWithBuild = {
  name: "error",
  nodeKinds: [
    "error/fail",
    "error/try",
    "error/attempt",
    "error/guard",
    "error/settle",
  ],
  defaultInterpreter: createErrorDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      error: {
        /** Throw an error value. */
        fail: (error: E) => ctx.node("error/fail", [error]),
        /** Try expr, catch with fallback. child 0 = expr, child 1 = catch body. */
        try: (expr: E, catchBody: E) =>
          ctx.node("error/try", [expr, catchBody]),
        /** Try expr without catch (rethrows). */
        tryOnly: (expr: E) => ctx.node("error/try", [expr]),
        /** Attempt expr, return {ok, err}. */
        attempt: (expr: E) => ctx.node("error/attempt", [expr]),
        /** Guard: if condition is false, throw error. */
        guard: (condition: E<boolean>, error: E) =>
          ctx.node("error/guard", [condition, error]),
        /** Settle: collect results from multiple exprs. */
        settle: (...exprs: E[]) =>
          ctx.node("error/settle", exprs),
      },
    };
  },
};
