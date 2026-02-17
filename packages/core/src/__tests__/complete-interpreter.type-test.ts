/**
 * Compile-time tests for branded Interpreter + Program<K> flow.
 * Checked by `tsc` only.
 */

import { defineInterpreter, foldAST, type Interpreter } from "../fold";
import type { CoreInput, CoreLiteral } from "../interpreters/core";
import type { Program } from "../types";

// --- Brand blocks raw construction ---
// @ts-expect-error brand prevents raw Interpreter construction
const _brandBlocked: Interpreter<"core/literal"> = {
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
};

// --- any rejected in defineInterpreter ---
const _badAny = defineInterpreter<"core/literal">()({
  // @ts-expect-error node:any rejected
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node;
  },
});

// --- wrong node type rejected ---
const _badWrongType = defineInterpreter<"core/literal">()({
  // @ts-expect-error wrong node type
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
});

// --- missing kind rejected ---
// @ts-expect-error missing core/input handler
const _badMissing = defineInterpreter<"core/literal" | "core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- unregistered kind rejected ---
const _badUnregistered = defineInterpreter<"unregistered/kind">()({
  // @ts-expect-error unregistered kind maps to never
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (_node: CoreLiteral) {
    return 0;
  },
});

// --- foldAST rejects unbranded object ---
declare const _program: Program<"core/literal" | "core/input">;
void foldAST(
  // @ts-expect-error foldAST requires branded Interpreter<K>
  {
    // biome-ignore lint/correctness/useYield: type test
    "core/literal": async function* (node: CoreLiteral) {
      return node.value;
    },
    // biome-ignore lint/correctness/useYield: type test
    "core/input": async function* (node: CoreInput) {
      return node.__inputData;
    },
  },
  _program,
);
