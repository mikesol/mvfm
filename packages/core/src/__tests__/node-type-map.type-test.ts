/**
 * Compile-time tests for NodeTypeMap + defineInterpreter type enforcement.
 * Checked by `tsc` — no runtime execution needed.
 * If someone loosens the types, @ts-expect-error lines become "unused"
 * and tsc reports an error.
 */

import { defineInterpreter } from "../fold";
import type { CoreInput, CoreLiteral } from "../interpreters/core";
import type { EqNeq } from "../plugins/eq/interpreter";
import type { OrdCmp } from "../plugins/ord/interpreter";
import type { StrUpperNode } from "../plugins/str/interpreter";

// --- Positive: correct handler compiles ---

const _correct = defineInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Positive: spread composition compiles ---

const _litInterp = defineInterpreter<"core/literal">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});
const _inputInterp = defineInterpreter<"core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/input": async function* (node: CoreInput) {
    return node.__inputData;
  },
});
const _composed = { ..._litInterp, ..._inputInterp };

// --- Negative: node: any rejected for registered kind ---

const _badAny = defineInterpreter<"core/literal">()({
  // @ts-expect-error handler with node:any rejected by IsAny check
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: any) {
    return node.value;
  },
});

// --- Negative: wrong node type rejected ---

const _badWrongType = defineInterpreter<"core/literal">()({
  // @ts-expect-error CoreInput should not satisfy handler for core/literal
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreInput) {
    return node.__inputData;
  },
});

// --- Negative: missing kind rejected ---

// @ts-expect-error missing "core/input" handler
const _badMissing = defineInterpreter<"core/literal" | "core/input">()({
  // biome-ignore lint/correctness/useYield: type test
  "core/literal": async function* (node: CoreLiteral) {
    return node.value;
  },
});

// --- Unregistered kind: any rejected (no fallback) ---

const _unregisteredBadAny = defineInterpreter<"unregistered/kind">()({
  // @ts-expect-error handler with node:any rejected even for unregistered kinds
  // biome-ignore lint/correctness/useYield: type test
  "unregistered/kind": async function* (node: any) {
    return node;
  },
});

// --- Coverage: error/fiber/control kinds must be registered ---

const _errorPositive = defineInterpreter<"error/fail">()({
  // biome-ignore lint/correctness/useYield: type test
  "error/fail": async function* (node) {
    throw node.error;
  },
});

const _fiberPositive = defineInterpreter<"fiber/timeout">()({
  // biome-ignore lint/correctness/useYield: type test
  "fiber/timeout": async function* (node) {
    return node.ms;
  },
});

const _controlPositive = defineInterpreter<"control/while">()({
  // biome-ignore lint/correctness/useYield: type test
  "control/while": async function* (node) {
    void node.body.length;
    return undefined;
  },
});

const _errorBadAny = defineInterpreter<"error/fail">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "error/fail": async function* (node: any) {
    return node.error;
  },
});

const _fiberBadAny = defineInterpreter<"fiber/timeout">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "fiber/timeout": async function* (node: any) {
    return node.ms;
  },
});

const _controlBadAny = defineInterpreter<"control/while">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "control/while": async function* (node: any) {
    return node.body.length;
  },
});

// --- str/eq/ord registrations ---

const _strCorrect = defineInterpreter<"str/upper">()({
  // biome-ignore lint/correctness/useYield: type test
  "str/upper": async function* (_node: StrUpperNode) {
    return "";
  },
});

const _eqCorrect = defineInterpreter<"eq/neq">()({
  // biome-ignore lint/correctness/useYield: type test
  "eq/neq": async function* (_node: EqNeq) {
    return false;
  },
});

const _ordCorrect = defineInterpreter<"ord/gt">()({
  // biome-ignore lint/correctness/useYield: type test
  "ord/gt": async function* (_node: OrdCmp) {
    return false;
  },
});

const _strWrongType = defineInterpreter<"str/upper">()({
  // @ts-expect-error EqNeq should not satisfy handler for str/upper
  // biome-ignore lint/correctness/useYield: type test
  "str/upper": async function* (node: EqNeq) {
    return node.inner;
  },
});

const _eqWrongType = defineInterpreter<"eq/neq">()({
  // @ts-expect-error OrdCmp should not satisfy handler for eq/neq
  // biome-ignore lint/correctness/useYield: type test
  "eq/neq": async function* (node: OrdCmp) {
    return node.operand;
  },
});

// --- boolean/num registrations ---

const _booleanCorrect = defineInterpreter<"boolean/not">()({
  // biome-ignore lint/correctness/useYield: type test
  "boolean/not": async function* (_node) {
    return true;
  },
});

const _numCorrect = defineInterpreter<"num/neg">()({
  // biome-ignore lint/correctness/useYield: type test
  "num/neg": async function* (_node) {
    return 0;
  },
});

const _booleanBadAny = defineInterpreter<"boolean/not">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "boolean/not": async function* (node: any) {
    return node.operand;
  },
});

const _numBadAny = defineInterpreter<"num/neg">()({
  // @ts-expect-error handler with node:any must be rejected once registered
  // biome-ignore lint/correctness/useYield: type test
  "num/neg": async function* (node: any) {
    return node.operand;
  },
});
