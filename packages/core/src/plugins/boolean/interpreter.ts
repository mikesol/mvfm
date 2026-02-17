import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_ } from "../../fold";

// ---- Typed node interfaces ----------------------------------

export interface BooleanAndNode extends TypedNode<boolean> {
  kind: "boolean/and";
  left: TypedNode<boolean>;
  right: TypedNode<boolean>;
}

export interface BooleanOrNode extends TypedNode<boolean> {
  kind: "boolean/or";
  left: TypedNode<boolean>;
  right: TypedNode<boolean>;
}

export interface BooleanNotNode extends TypedNode<boolean> {
  kind: "boolean/not";
  operand: TypedNode<boolean>;
}

export interface BooleanEqNode extends TypedNode<boolean> {
  kind: "boolean/eq";
  left: TypedNode<boolean>;
  right: TypedNode<boolean>;
}

export interface BooleanFalseNode extends TypedNode<boolean> {
  kind: "boolean/ff";
}

export interface BooleanTrueNode extends TypedNode<boolean> {
  kind: "boolean/tt";
}

export interface BooleanImpliesNode extends TypedNode<boolean> {
  kind: "boolean/implies";
  left: TypedNode<boolean>;
  right: TypedNode<boolean>;
}

export interface BooleanShowNode extends TypedNode<string> {
  kind: "boolean/show";
  operand: TypedNode<boolean>;
}

export interface BooleanTopNode extends TypedNode<boolean> {
  kind: "boolean/top";
}

export interface BooleanBottomNode extends TypedNode<boolean> {
  kind: "boolean/bottom";
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "boolean/and": BooleanAndNode;
    "boolean/or": BooleanOrNode;
    "boolean/not": BooleanNotNode;
    "boolean/eq": BooleanEqNode;
    "boolean/ff": BooleanFalseNode;
    "boolean/tt": BooleanTrueNode;
    "boolean/implies": BooleanImpliesNode;
    "boolean/show": BooleanShowNode;
    "boolean/top": BooleanTopNode;
    "boolean/bottom": BooleanBottomNode;
  }
}

type BooleanKinds =
  | "boolean/and"
  | "boolean/or"
  | "boolean/not"
  | "boolean/eq"
  | "boolean/ff"
  | "boolean/tt"
  | "boolean/implies"
  | "boolean/show"
  | "boolean/top"
  | "boolean/bottom";

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `boolean/` node kinds. */
export const booleanInterpreter = defineInterpreter<BooleanKinds>()({
  "boolean/and": async function* (node: BooleanAndNode) {
    const left = yield* eval_(node.left);
    return left ? yield* eval_(node.right) : false;
  },
  "boolean/or": async function* (node: BooleanOrNode) {
    const left = yield* eval_(node.left);
    return left ? true : yield* eval_(node.right);
  },
  "boolean/not": async function* (node: BooleanNotNode) {
    return !(yield* eval_(node.operand));
  },
  "boolean/eq": async function* (node: BooleanEqNode) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/ff": async function* (_node: BooleanFalseNode) {
    return false;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/tt": async function* (_node: BooleanTrueNode) {
    return true;
  },
  "boolean/implies": async function* (node: BooleanImpliesNode) {
    const left = yield* eval_(node.left);
    return !left ? true : yield* eval_(node.right);
  },
  "boolean/show": async function* (node: BooleanShowNode) {
    return String(yield* eval_(node.operand));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/top": async function* (_node: BooleanTopNode) {
    return true;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/bottom": async function* (_node: BooleanBottomNode) {
    return false;
  },
});
