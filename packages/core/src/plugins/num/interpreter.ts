import type { Interpreter, TypedNode } from "../../fold";
import { eval_ } from "../../fold";

// ---- Typed node interfaces ----------------------------------

interface NumBinOp extends TypedNode<number> {
  left: TypedNode<number>;
  right: TypedNode<number>;
}

interface NumUnaryOp extends TypedNode<number> {
  operand: TypedNode<number>;
}

interface NumVariadic extends TypedNode<number> {
  values: TypedNode<number>[];
}

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `num/` node kinds. */
export const numInterpreter: Interpreter = {
  "num/add": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) + (yield* eval_(node.right));
  },
  "num/sub": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) - (yield* eval_(node.right));
  },
  "num/mul": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) * (yield* eval_(node.right));
  },
  "num/div": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) / (yield* eval_(node.right));
  },
  "num/mod": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) % (yield* eval_(node.right));
  },
  "num/compare": async function* (node: NumBinOp) {
    const l = yield* eval_(node.left);
    const r = yield* eval_(node.right);
    return l < r ? -1 : l === r ? 0 : 1;
  },
  "num/neg": async function* (node: NumUnaryOp) {
    return -(yield* eval_(node.operand));
  },
  "num/abs": async function* (node: NumUnaryOp) {
    return Math.abs(yield* eval_(node.operand));
  },
  "num/floor": async function* (node: NumUnaryOp) {
    return Math.floor(yield* eval_(node.operand));
  },
  "num/ceil": async function* (node: NumUnaryOp) {
    return Math.ceil(yield* eval_(node.operand));
  },
  "num/round": async function* (node: NumUnaryOp) {
    return Math.round(yield* eval_(node.operand));
  },
  "num/min": async function* (node: NumVariadic) {
    const values: number[] = [];
    for (const v of node.values) values.push(yield* eval_(v));
    return Math.min(...values);
  },
  "num/max": async function* (node: NumVariadic) {
    const values: number[] = [];
    for (const v of node.values) values.push(yield* eval_(v));
    return Math.max(...values);
  },
  "num/eq": async function* (node: NumBinOp) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/zero": async function* () {
    return 0;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/one": async function* () {
    return 1;
  },
  "num/show": async function* (node: NumUnaryOp) {
    return String(yield* eval_(node.operand));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/top": async function* () {
    return Infinity;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "num/bottom": async function* () {
    return -Infinity;
  },
};
