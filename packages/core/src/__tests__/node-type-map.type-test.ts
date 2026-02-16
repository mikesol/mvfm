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

// --- Coverage: error/fiber/control kinds must be registered ---

const _errorPositive = typedInterpreter<"error/fail">()({
  // biome-ignore lint/correctness/useYield: type test
  "error/fail": async function* (node) {
    throw node.error;
  },
});

const _fiberPositive = typedInterpreter<"fiber/timeout">()({
  // biome-ignore lint/correctness/useYield: type test
  "fiber/timeout": async function* (node) {
    return node.ms;
  },
});

const _controlPositive = typedInterpreter<"control/while">()({
  // biome-ignore lint/correctness/useYield: type test
  "control/while": async function* (node) {
    void node.body.length;
    return undefined;
  },
});

const _errorBadAny = typedInterpreter<"error/fail">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "error/fail": async function* (node: any) {
    return node.error;
  },
});

const _fiberBadAny = typedInterpreter<"fiber/timeout">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "fiber/timeout": async function* (node: any) {
    return node.ms;
  },
});

const _controlBadAny = typedInterpreter<"control/while">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "control/while": async function* (node: any) {
    return node.body.length;
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
