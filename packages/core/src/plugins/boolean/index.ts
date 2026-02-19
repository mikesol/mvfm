/**
 * DAG-model boolean plugin definition.
 *
 * Provides boolean operations as CExpr builders.
 */

import type { PluginDefWithBuild, BuildContext } from "../../dag/builder";
import { createBooleanDagInterpreter } from "./interpreter";
import type { CExpr } from "../../dag/00-expr";

type E<T = unknown> = CExpr<T, string, unknown>;

/** DAG-model boolean plugin definition. */
export const booleanDagPlugin: PluginDefWithBuild = {
  name: "boolean",
  nodeKinds: [
    "boolean/and",
    "boolean/or",
    "boolean/not",
    "boolean/eq",
    "boolean/ff",
    "boolean/tt",
    "boolean/implies",
    "boolean/show",
    "boolean/top",
    "boolean/bottom",
  ],
  defaultInterpreter: createBooleanDagInterpreter,
  build(ctx: BuildContext): Record<string, unknown> {
    return {
      boolean: {
        /** Logical AND (short-circuits). */
        and: (a: E<boolean>, b: E<boolean>) =>
          ctx.node("boolean/and", [a, b]),
        /** Logical OR (short-circuits). */
        or: (a: E<boolean>, b: E<boolean>) =>
          ctx.node("boolean/or", [a, b]),
        /** Logical NOT. */
        not: (a: E<boolean>) => ctx.node("boolean/not", [a]),
        /** Boolean equality. */
        eq: (a: E<boolean>, b: E<boolean>) =>
          ctx.node("boolean/eq", [a, b]),
        /** False literal. */
        ff: () => ctx.node("boolean/ff", []),
        /** True literal. */
        tt: () => ctx.node("boolean/tt", []),
        /** Logical implication. */
        implies: (a: E<boolean>, b: E<boolean>) =>
          ctx.node("boolean/implies", [a, b]),
        /** Show boolean as string. */
        show: (a: E<boolean>) => ctx.node("boolean/show", [a]),
        /** Top (true). */
        top: () => ctx.node("boolean/top", []),
        /** Bottom (false). */
        bottom: () => ctx.node("boolean/bottom", []),
      },
    };
  },
};
