/**
 * DAG-model fiber plugin definition.
 *
 * Provides par, race, seq concurrency primitives.
 * Default interpreter evaluates sequentially.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createFiberDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model fiber plugin definition. */
export const fiberDagPlugin: PluginDefWithBuild = {
  name: "fiber",
  nodeKinds: ["fiber/par", "fiber/race", "fiber/seq"],
  defaultInterpreter: createFiberDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      fiber: {
        /** Run children in parallel, return all results. */
        par: (...branches: E[]) =>
          ctx.node("fiber/par", branches),
        /** Race: first to complete wins. */
        race: (...branches: E[]) =>
          ctx.node("fiber/race", branches),
        /** Sequential: run in order, return last. */
        seq: (...steps: E[]) =>
          ctx.node("fiber/seq", steps),
      },
    };
  },
};
