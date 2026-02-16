import type { TypedNode } from "../../fold";
import { eval_, typedInterpreter } from "../../fold";

export interface EqNeq extends TypedNode<boolean> {
  kind: "eq/neq";
  inner: TypedNode<boolean>;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "eq/neq": EqNeq;
  }
}

/** Interpreter handlers for `eq/` node kinds. */
export const eqInterpreter = typedInterpreter<"eq/neq">()({
  "eq/neq": async function* (node: EqNeq) {
    return !(yield* eval_(node.inner));
  },
});
