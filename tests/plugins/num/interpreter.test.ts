import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";
import { semiring } from "../../../src/plugins/semiring";

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

const app = ilo(num, semiring, ord);

describe("num interpreter: arithmetic", () => {
  it("add", () => expect(run(app(($) => $.add(3, 4)))).toBe(7));
  it("sub", () => expect(run(app(($) => $.sub(10, 3)))).toBe(7));
  it("mul", () => expect(run(app(($) => $.mul(3, 4)))).toBe(12));
  it("div", () => expect(run(app(($) => $.div(12, 4)))).toBe(3));
  it("mod", () => expect(run(app(($) => $.mod(10, 3)))).toBe(1));
  it("neg", () => expect(run(app(($) => $.neg(5)))).toBe(-5));
  it("abs", () => expect(run(app(($) => $.abs(-5)))).toBe(5));
  it("floor", () => expect(run(app(($) => $.floor(3.7)))).toBe(3));
  it("ceil", () => expect(run(app(($) => $.ceil(3.2)))).toBe(4));
  it("round", () => expect(run(app(($) => $.round(3.5)))).toBe(4));
  it("min", () => expect(run(app(($) => $.min(3, 1, 4, 1, 5)))).toBe(1));
  it("max", () => expect(run(app(($) => $.max(3, 1, 4, 1, 5)))).toBe(5));
});

describe("num interpreter: comparisons", () => {
  it("gt true", () => expect(run(app(($) => $.gt(5, 3)))).toBe(true));
  it("gt false", () => expect(run(app(($) => $.gt(3, 5)))).toBe(false));
  it("gte", () => expect(run(app(($) => $.gte(5, 5)))).toBe(true));
  it("lt", () => expect(run(app(($) => $.lt(3, 5)))).toBe(true));
  it("lte", () => expect(run(app(($) => $.lte(5, 5)))).toBe(true));
});

describe("num interpreter: with input", () => {
  it("$.add($.input.x, $.input.y)", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.add($.input.x, $.input.y));
    expect(run(prog, { x: 10, y: 20 })).toBe(30);
  });
});
