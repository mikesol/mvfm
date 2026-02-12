import type { PluginDefinition } from "../../core";

export type BooleanMethods = {};

export const boolean: PluginDefinition<BooleanMethods> = {
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
};
