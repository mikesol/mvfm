/**
 * DAG-model ord plugin definition.
 *
 * The ord plugin derives gt, gte, lt, lte from a compare result.
 * The actual compare dispatch is handled by type-specific plugins
 * (e.g., num/compare).
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createOrdDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model ord plugin definition. */
export const ordDagPlugin: PluginDefWithBuild = {
  name: "ord",
  nodeKinds: ["ord/gt", "ord/gte", "ord/lt", "ord/lte"],
  defaultInterpreter: createOrdDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      ord: {
        /** Greater than: compare > 0. */
        gt: (compareResult: E<number>) =>
          ctx.node("ord/gt", [compareResult]),
        /** Greater than or equal: compare >= 0. */
        gte: (compareResult: E<number>) =>
          ctx.node("ord/gte", [compareResult]),
        /** Less than: compare < 0. */
        lt: (compareResult: E<number>) =>
          ctx.node("ord/lt", [compareResult]),
        /** Less than or equal: compare <= 0. */
        lte: (compareResult: E<number>) =>
          ctx.node("ord/lte", [compareResult]),
      },
    };
  },
};
