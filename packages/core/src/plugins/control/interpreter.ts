import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_, recurseScoped } from "../../fold";

interface ControlParam {
  __id: number;
}

interface ControlEachNode extends TypedNode<void> {
  kind: "control/each";
  collection: TypedNode<unknown[]>;
  param: ControlParam;
  body: TypedNode[];
}

interface ControlWhileNode extends TypedNode<void> {
  kind: "control/while";
  condition: TypedNode<boolean>;
  body: TypedNode[];
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "control/each": ControlEachNode;
    "control/while": ControlWhileNode;
  }
}

/** Interpreter handlers for `control/` node kinds. */
export const controlInterpreter = defineInterpreter<"control/each" | "control/while">()({
  "control/each": async function* (node: ControlEachNode) {
    const collection = yield* eval_(node.collection);
    for (const item of collection) {
      for (const statement of node.body) {
        yield recurseScoped(statement, [{ paramId: node.param.__id, value: item }]);
      }
    }
    return undefined;
  },

  "control/while": async function* (node: ControlWhileNode) {
    // Evaluate condition before each iteration to preserve while-loop semantics.
    while (yield* eval_(node.condition)) {
      for (const statement of node.body) {
        yield* eval_(statement);
      }
    }
    return undefined;
  },
});
