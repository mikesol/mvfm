import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
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
  const interp = composeInterpreters([coreInterpreter, numInterpreter]);
  return interp(ast.result);
}

const app = ilo(num, semiring);

describe("semiring interpreter: arithmetic", () => {
  it("add", () => expect(run(app(($) => $.add(3, 4)))).toBe(7));
  it("mul", () => expect(run(app(($) => $.mul(3, 4)))).toBe(12));
});

describe("semiring interpreter: with input", () => {
  it("$.add($.input.x, $.input.y)", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.add($.input.x, $.input.y));
    expect(run(prog, { x: 10, y: 20 })).toBe(30);
  });
});
