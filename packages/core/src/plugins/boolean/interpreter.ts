import type { Interpreter, TypedNode } from "../../fold";
import { eval_ } from "../../fold";

// ---- Typed node interfaces ----------------------------------

interface BoolBinOp extends TypedNode<boolean> {
  left: TypedNode<boolean>;
  right: TypedNode<boolean>;
}

interface BoolUnary extends TypedNode<boolean> {
  operand: TypedNode<boolean>;
}

// ---- Interpreter map ----------------------------------------

/** Interpreter handlers for `boolean/` node kinds. */
export const booleanInterpreter: Interpreter = {
  "boolean/and": async function* (node: BoolBinOp) {
    const left = yield* eval_(node.left);
    return left ? yield* eval_(node.right) : false;
  },
  "boolean/or": async function* (node: BoolBinOp) {
    const left = yield* eval_(node.left);
    return left ? true : yield* eval_(node.right);
  },
  "boolean/not": async function* (node: BoolUnary) {
    return !(yield* eval_(node.operand));
  },
  "boolean/eq": async function* (node: BoolBinOp) {
    return (yield* eval_(node.left)) === (yield* eval_(node.right));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/ff": async function* () {
    return false;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/tt": async function* () {
    return true;
  },
  "boolean/implies": async function* (node: BoolBinOp) {
    const left = yield* eval_(node.left);
    return !left ? true : yield* eval_(node.right);
  },
  "boolean/show": async function* (node: BoolUnary) {
    return String(yield* eval_(node.operand));
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/top": async function* () {
    return true;
  },
  // biome-ignore lint/correctness/useYield: leaf handler
  "boolean/bottom": async function* () {
    return false;
  },
};
