/**
 * DAG-model eq plugin definition.
 *
 * The eq plugin provides neq (not-equal) by negating an eq result.
 * The actual eq dispatch is handled by type-specific plugins
 * (num/eq, str/eq, boolean/eq).
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createEqDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model eq plugin definition. */
export const eqDagPlugin: PluginDefWithBuild = {
  name: "eq",
  nodeKinds: ["eq/neq"],
  defaultInterpreter: createEqDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      eq: {
        /** Negate an equality result. */
        neq: (inner: E<boolean>) =>
          ctx.node("eq/neq", [inner]),
      },
    };
  },
};
