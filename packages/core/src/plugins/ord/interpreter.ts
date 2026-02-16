import type { Interpreter, TypedNode } from "../../fold";
import { eval_ } from "../../fold";

interface OrdCmp extends TypedNode<boolean> {
  operand: TypedNode<number>;
}

/** Interpreter handlers for `ord/` node kinds. */
export const ordInterpreter: Interpreter = {
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
};
