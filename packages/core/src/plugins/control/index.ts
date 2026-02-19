/**
 * DAG-model control plugin definition.
 *
 * Provides each (collection iteration) and while (conditional loop).
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createControlDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model control plugin definition. */
export const controlDagPlugin: PluginDefWithBuild = {
  name: "control",
  nodeKinds: ["control/each", "control/while"],
  defaultInterpreter: createControlDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      control: {
        /** Iterate over collection. child 0 = collection, children[1..N] = body. */
        each: (collection: E<unknown[]>, ...body: E[]) =>
          ctx.node("control/each", [collection, ...body]),
        /** While loop. child 0 = condition, children[1..N] = body. */
        while: (condition: E<boolean>, ...body: E[]) =>
          ctx.node("control/while", [condition, ...body]),
      },
    };
  },
};
