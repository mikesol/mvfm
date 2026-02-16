import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
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

const combined = { ...coreInterpreter, ...numInterpreter };

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await foldAST(combined, ast.result);
}

const app = mvfm(num, semiring);

describe("semiring interpreter: arithmetic", () => {
  it("add", async () => expect(await run(app(($) => $.add(3, 4)))).toBe(7));
  it("mul", async () => expect(await run(app(($) => $.mul(3, 4)))).toBe(12));
});

describe("semiring interpreter: with input", () => {
  it("$.add($.input.x, $.input.y)", async () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.add($.input.x, $.input.y));
    expect(await run(prog, { x: 10, y: 20 })).toBe(30);
  });
});
