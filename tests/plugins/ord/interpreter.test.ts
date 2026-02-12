import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, numInterpreter, ordInterpreter]);
  return interp(ast.result);
}

const app = ilo(num, ord);

describe("ord interpreter: compare", () => {
  it("compare(3, 5) returns -1", () => expect(run(app(($) => $.compare(3, 5)))).toBe(-1));
  it("compare(5, 5) returns 0", () => expect(run(app(($) => $.compare(5, 5)))).toBe(0));
  it("compare(5, 3) returns 1", () => expect(run(app(($) => $.compare(5, 3)))).toBe(1));
});

describe("ord interpreter: derived comparisons", () => {
  it("gt true", () => expect(run(app(($) => $.gt(5, 3)))).toBe(true));
  it("gt false", () => expect(run(app(($) => $.gt(3, 5)))).toBe(false));
  it("gt equal", () => expect(run(app(($) => $.gt(5, 5)))).toBe(false));
  it("gte true", () => expect(run(app(($) => $.gte(5, 5)))).toBe(true));
  it("gte false", () => expect(run(app(($) => $.gte(3, 5)))).toBe(false));
  it("lt true", () => expect(run(app(($) => $.lt(3, 5)))).toBe(true));
  it("lt false", () => expect(run(app(($) => $.lt(5, 3)))).toBe(false));
  it("lte true", () => expect(run(app(($) => $.lte(5, 5)))).toBe(true));
  it("lte false", () => expect(run(app(($) => $.lte(5, 3)))).toBe(false));
});

describe("ord interpreter: with input", () => {
  it("$.gt($.input.x, $.input.y)", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.gt($.input.x, $.input.y));
    expect(run(prog, { x: 10, y: 5 })).toBe(true);
    expect(run(prog, { x: 5, y: 10 })).toBe(false);
  });
});
