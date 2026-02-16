import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { coreInterpreter } from "../../../src/interpreters/core";
import { semigroup } from "../../../src/plugins/semigroup";
import { str } from "../../../src/plugins/str";
import { strInterpreter } from "../../../src/plugins/str/interpreter";

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

const combined = { ...coreInterpreter, ...strInterpreter };

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  return await foldAST(combined, ast.result);
}

const app = mvfm(str, semigroup);

describe("semigroup interpreter", () => {
  it("append('foo', 'bar') returns 'foobar'", async () => {
    expect(await run(app(($) => $.append("foo", "bar")))).toBe("foobar");
  });

  it("append with empty string", async () => {
    expect(await run(app(($) => $.append("hello", "")))).toBe("hello");
  });

  it("append with input", async () => {
    const prog = app({ x: "string" }, ($) => $.append($.input.x, "!"));
    expect(await run(prog, { x: "hi" })).toBe("hi!");
  });
});
