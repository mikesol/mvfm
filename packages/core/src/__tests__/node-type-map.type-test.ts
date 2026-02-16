/**
 * Compile-time tests for NodeTypeMap + typedInterpreter type enforcement.
 * Checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 */

import { typedInterpreter } from "../fold";
import type { CoreInput, CoreLiteral } from "../interpreters/core";
import type { EqNeq } from "../plugins/eq/interpreter";
import type { OrdCmp } from "../plugins/ord/interpreter";
import type { StrUpperNode } from "../plugins/str/interpreter";

// --- Positive: correct handler compiles ---

const _correct = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Positive: spread composition compiles ---

const _litInterp = typedInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});
const _inputInterp = typedInterpreter<"core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },
});
const _composed = { ..._litInterp, ..._inputInterp };

// --- Negative: node: any rejected for registered kind ---

const _badAny = typedInterpreter<"core/literal">()({
  // @ts-expect-error handler with node:any rejected by IsAny check
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node.value;
  },
});

// --- Negative: wrong node type rejected ---

const _badWrongType = typedInterpreter<"core/literal">()({
  // @ts-expect-error CoreInput should not satisfy handler for core/literal
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
});

// --- Negative: missing kind rejected ---

// @ts-expect-error missing "core/input" handler
const _badMissing = typedInterpreter<"core/literal" | "core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Unregistered kind: any fallback (temporary) ---

const _unregistered = typedInterpreter<"unregistered/kind">()({
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
});

// --- str/eq/ord registrations ---

const _strCorrect = typedInterpreter<"str/upper">()({
  // biome-ignore lint/correctness/useYield: type test
  "str/upper": async function* (_node: StrUpperNode) {
    return "";
  },
});

const _eqCorrect = typedInterpreter<"eq/neq">()({
  // biome-ignore lint/correctness/useYield: type test
  "eq/neq": async function* (_node: EqNeq) {
    return false;
  },
});

const _ordCorrect = typedInterpreter<"ord/gt">()({
  // biome-ignore lint/correctness/useYield: type test
  "ord/gt": async function* (_node: OrdCmp) {
    return false;
  },
});

const _strWrongType = typedInterpreter<"str/upper">()({
  // @ts-expect-error EqNeq should not satisfy handler for str/upper
  // biome-ignore lint/correctness/useYield: type test
  "str/upper": async function* (node: EqNeq) {
    return node.inner;
  },
});

const _eqWrongType = typedInterpreter<"eq/neq">()({
  // @ts-expect-error OrdCmp should not satisfy handler for eq/neq
  // biome-ignore lint/correctness/useYield: type test
  "eq/neq": async function* (node: OrdCmp) {
    return node.operand;
  },
});
