import type { TypedNode } from "../../fold";
import { defineInterpreter, eval_ } from "../../fold";

// ---- Typed node interfaces ----------------------------------

export interface NumAddNode extends TypedNode<number> {
  kind: "num/add";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumSubNode extends TypedNode<number> {
  kind: "num/sub";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumMulNode extends TypedNode<number> {
  kind: "num/mul";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumDivNode extends TypedNode<number> {
  kind: "num/div";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumModNode extends TypedNode<number> {
  kind: "num/mod";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumCompareNode extends TypedNode<number> {
  kind: "num/compare";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumNegNode extends TypedNode<number> {
  kind: "num/neg";
  operand: TypedNode<number>;
}

export interface NumAbsNode extends TypedNode<number> {
  kind: "num/abs";
  operand: TypedNode<number>;
}

export interface NumFloorNode extends TypedNode<number> {
  kind: "num/floor";
  operand: TypedNode<number>;
}

export interface NumCeilNode extends TypedNode<number> {
  kind: "num/ceil";
  operand: TypedNode<number>;
}

export interface NumRoundNode extends TypedNode<number> {
  kind: "num/round";
  operand: TypedNode<number>;
}

export interface NumMinNode extends TypedNode<number> {
  kind: "num/min";
  values: TypedNode<number>[];
}

export interface NumMaxNode extends TypedNode<number> {
  kind: "num/max";
  values: TypedNode<number>[];
}

export interface NumEqNode extends TypedNode<boolean> {
  kind: "num/eq";
  left: TypedNode<number>;
  right: TypedNode<number>;
}

export interface NumZeroNode extends TypedNode<number> {
  kind: "num/zero";
}

export interface NumOneNode extends TypedNode<number> {
  kind: "num/one";
}

export interface NumShowNode extends TypedNode<string> {
  kind: "num/show";
  operand: TypedNode<number>;
}

export interface NumTopNode extends TypedNode<number> {
  kind: "num/top";
}

export interface NumBottomNode extends TypedNode<number> {
  kind: "num/bottom";
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "num/add": NumAddNode;
    "num/sub": NumSubNode;
    "num/mul": NumMulNode;
    "num/div": NumDivNode;
    "num/mod": NumModNode;
    "num/compare": NumCompareNode;
    "num/neg": NumNegNode;
    "num/abs": NumAbsNode;
    "num/floor": NumFloorNode;
    "num/ceil": NumCeilNode;
    "num/round": NumRoundNode;
    "num/min": NumMinNode;
    "num/max": NumMaxNode;
    "num/eq": NumEqNode;
    "num/zero": NumZeroNode;
    "num/one": NumOneNode;
    "num/show": NumShowNode;
    "num/top": NumTopNode;
    "num/bottom": NumBottomNode;
  }
}

type NumKinds =
  | "num/add"
  | "num/sub"
  | "num/mul"
  | "num/div"
  | "num/mod"
  | "num/compare"
  | "num/neg"
  | "num/abs"
  | "num/floor"
  | "num/ceil"
  | "num/round"
  | "num/min"
  | "num/max"
  | "num/eq"
  | "num/zero"
  | "num/one"
  | "num/show"
  | "num/top"
  | "num/bottom";

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `num/` node kinds. */
export const numInterpreter = defineInterpreter<NumKinds>()({
  "num/add": async function* (node: NumAddNode) {
    return (yield* eval_(node.left)) + (yield* eval_(node.right));
  },
  "num/sub": async function* (node: NumSubNode) {
    return (yield* eval_(node.left)) - (yield* eval_(node.right));
  },
  "num/mul": async function* (node: NumMulNode) {
    return (yield* eval_(node.left)) * (yield* eval_(node.right));
  },
  "num/div": async function* (node: NumDivNode) {
    return (yield* eval_(node.left)) / (yield* eval_(node.right));
  },
  "num/mod": async function* (node: NumModNode) {
    return (yield* eval_(node.left)) % (yield* eval_(node.right));
  },
  "num/compare": async function* (node: NumCompareNode) {
    const l = yield* eval_(node.left);
    const r = yield* eval_(node.right);
    return l < r ? -1 : l === r ? 0 : 1;
  },
  "num/neg": async function* (node: NumNegNode) {
    return -(yield* eval_(node.operand));
  },
  "num/abs": async function* (node: NumAbsNode) {
    return Math.abs(yield* eval_(node.operand));
  },
  "num/floor": async function* (node: NumFloorNode) {
    return Math.floor(yield* eval_(node.operand));
  },
  "num/ceil": async function* (node: NumCeilNode) {
    return Math.ceil(yield* eval_(node.operand));
  },
  "num/round": async function* (node: NumRoundNode) {
    return Math.round(yield* eval_(node.operand));
  },
  "num/min": async function* (node: NumMinNode) {
    const values: number[] = [];
    for (const v of node.values) values.push(yield* eval_(v));
    return Math.min(...values);
  },
  "num/max": async function* (node: NumMaxNode) {
    const values: number[] = [];
    for (const v of node.values) values.push(yield* eval_(v));
    return Math.max(...values);
  },
  "num/eq": async function* (node: NumEqNode) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/zero": async function* (_node: NumZeroNode) {
    return 0;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/one": async function* (_node: NumOneNode) {
    return 1;
  },
  "num/show": async function* (node: NumShowNode) {
    return String(yield* eval_(node.operand));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/top": async function* (_node: NumTopNode) {
    return Infinity;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/bottom": async function* (_node: NumBottomNode) {
    return -Infinity;
  },
});
