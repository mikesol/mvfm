import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";
import { semiring } from "../../../src/plugins/semiring";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...numInterpreter, ...ordInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}

const app = mvfm(num, semiring, ord);

describe("num interpreter: arithmetic", () => {
  it("add", async () => expect(await run(app(($) => $.add(3, 4)))).toBe(7));
  it("sub", async () => expect(await run(app(($) => $.sub(10, 3)))).toBe(7));
  it("mul", async () => expect(await run(app(($) => $.mul(3, 4)))).toBe(12));
  it("div", async () => expect(await run(app(($) => $.div(12, 4)))).toBe(3));
  it("mod", async () => expect(await run(app(($) => $.mod(10, 3)))).toBe(1));
  it("neg", async () => expect(await run(app(($) => $.neg(5)))).toBe(-5));
  it("abs", async () => expect(await run(app(($) => $.abs(-5)))).toBe(5));
  it("floor", async () => expect(await run(app(($) => $.floor(3.7)))).toBe(3));
  it("ceil", async () => expect(await run(app(($) => $.ceil(3.2)))).toBe(4));
  it("round", async () => expect(await run(app(($) => $.round(3.5)))).toBe(4));
  it("min", async () => expect(await run(app(($) => $.min(3, 1, 4, 1, 5)))).toBe(1));
  it("max", async () => expect(await run(app(($) => $.max(3, 1, 4, 1, 5)))).toBe(5));
});

describe("num interpreter: comparisons", () => {
  it("gt true", async () => expect(await run(app(($) => $.gt(5, 3)))).toBe(true));
  it("gt false", async () => expect(await run(app(($) => $.gt(3, 5)))).toBe(false));
  it("gte", async () => expect(await run(app(($) => $.gte(5, 5)))).toBe(true));
  it("lt", async () => expect(await run(app(($) => $.lt(3, 5)))).toBe(true));
  it("lte", async () => expect(await run(app(($) => $.lte(5, 5)))).toBe(true));
});

describe("num interpreter: with input", () => {
  it("$.add($.input.x, $.input.y)", async () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.add($.input.x, $.input.y));
    expect(await run(prog, { x: 10, y: 20 })).toBe(30);
  });
});

describe("num interpreter: show", () => {
  it("num/show converts number to string", async () => {
    const ast = {
      kind: "num/show",
      operand: { kind: "core/literal", value: 42, __id: "t" },
    };
    expect(await foldAST(combined, ast)).toBe("42");
  });
});

describe("num interpreter: bounded", () => {
  it("num/top returns Infinity", async () => {
    expect(await foldAST(combined, { kind: "num/top" })).toBe(Infinity);
  });

  it("num/bottom returns -Infinity", async () => {
    expect(await foldAST(combined, { kind: "num/bottom" })).toBe(-Infinity);
  });
});
