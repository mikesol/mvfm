import { definePlugin } from "../../core";
import { booleanInterpreter } from "./interpreter";

/** Boolean type plugin. Provides no direct methods — exposes trait implementations for eq, show, bounded, and heytingAlgebra. */
export type BooleanMethods = {};

/** Boolean type plugin. Namespace: `boolean/`. Registers boolean trait implementations for use by typeclass plugins. */
export const boolean = definePlugin({
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
  defaultInterpreter: booleanInterpreter,
  traits: {
    eq: { type: "boolean", nodeKinds: { eq: "boolean/eq" } },
    show: { type: "boolean", nodeKinds: { show: "boolean/show" } },
    bounded: { type: "boolean", nodeKinds: { top: "boolean/top", bottom: "boolean/bottom" } },
    heytingAlgebra: {
      type: "boolean",
      nodeKinds: {
        conj: "boolean/and",
        disj: "boolean/or",
        not: "boolean/not",
        ff: "boolean/ff",
        tt: "boolean/tt",
        implies: "boolean/implies",
      },
    },
  },
  build(): BooleanMethods {
    return {};
  },
});
