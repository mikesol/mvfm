import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { eq } from "../../../src/plugins/eq";
import { heytingAlgebra } from "../../../src/plugins/heyting-algebra";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";

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

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, numInterpreter, booleanInterpreter]);
  return await interp(ast.result);
}

const app = ilo(num, boolean, eq, heytingAlgebra);

describe("heytingAlgebra interpreter", () => {
  it("and true", async () => {
    const prog = app(($) => $.and($.eq(1, 1), $.eq(2, 2)));
    expect(await run(prog)).toBe(true);
  });

  it("and false", async () => {
    const prog = app(($) => $.and($.eq(1, 1), $.eq(1, 2)));
    expect(await run(prog)).toBe(false);
  });

  it("or true", async () => {
    const prog = app(($) => $.or($.eq(1, 2), $.eq(2, 2)));
    expect(await run(prog)).toBe(true);
  });

  it("or false", async () => {
    const prog = app(($) => $.or($.eq(1, 2), $.eq(3, 4)));
    expect(await run(prog)).toBe(false);
  });

  it("not true", async () => {
    const prog = app(($) => $.not($.eq(1, 2)));
    expect(await run(prog)).toBe(true);
  });

  it("not false", async () => {
    const prog = app(($) => $.not($.eq(1, 1)));
    expect(await run(prog)).toBe(false);
  });
});
