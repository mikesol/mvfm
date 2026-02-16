import type { Interpreter, TypedNode } from "../../fold";
import { eval_ } from "../../fold";

interface EqNeq extends TypedNode<boolean> {
  kind: "eq/neq";
  inner: TypedNode<boolean>;
}

/** Interpreter handlers for `eq/` node kinds. */
export const eqInterpreter: Interpreter = {
  "eq/neq": async function* (node: EqNeq) {
    return !(yield* eval_(node.inner));
  },
};
