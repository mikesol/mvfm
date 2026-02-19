/**
 * DAG-model st (mutable state) plugin definition.
 *
 * Provides let/get/set/push for mutable local variables.
 * The ref name is stored in `out`. st/get is volatile (always re-evaluates).
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createStDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model st plugin definition. */
export const stDagPlugin: PluginDefWithBuild = {
  name: "st",
  nodeKinds: ["st/let", "st/get", "st/set", "st/push"],
  defaultInterpreter: createStDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    let refCounter = 0;
    return {
      st: {
        /** Declare a mutable variable with initial value. Returns ref name. */
        let: (initial: E, refName?: string) => {
          const ref = refName ?? `st_${refCounter++}`;
          return {
            /** The let node (must be evaluated to initialize). */
            init: ctx.node("st/let", [initial], ref),
            /** Get current value (volatile). */
            get: () => ctx.node("st/get", [], ref),
            /** Set new value. */
            set: (value: E) => ctx.node("st/set", [value], ref),
            /** Push to array. */
            push: (value: E) => ctx.node("st/push", [value], ref),
            /** The ref name for debugging. */
            ref,
          };
        },
      },
    };
  },
};
