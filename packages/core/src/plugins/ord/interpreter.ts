import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_ } from "../../fold";

export interface OrdCmp extends TypedNode<boolean> {
  kind: "ord/gt" | "ord/gte" | "ord/lt" | "ord/lte";
  operand: TypedNode<number>;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "ord/gt": OrdCmp;
    "ord/gte": OrdCmp;
    "ord/lt": OrdCmp;
    "ord/lte": OrdCmp;
  }
}

/** Interpreter handlers for `ord/` node kinds. */
export const ordInterpreter = defineInterpreter<"ord/gt" | "ord/gte" | "ord/lt" | "ord/lte">()({
  "ord/gt": async function* (node: OrdCmp) {
    return (yield* eval_(node.operand)) > 0;
  },
  "ord/gte": async function* (node: OrdCmp) {
    return (yield* eval_(node.operand)) >= 0;
  },
  "ord/lt": async function* (node: OrdCmp) {
    return (yield* eval_(node.operand)) < 0;
  },
  "ord/lte": async function* (node: OrdCmp) {
    return (yield* eval_(node.operand)) <= 0;
  },
});
