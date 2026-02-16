import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { ord } from "../../../src/plugins/ord";
import { ordInterpreter } from "../../../src/plugins/ord/interpreter";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...numInterpreter, ...ordInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}

const app = mvfm(num, ord);

describe("ord interpreter: compare", () => {
  it("compare(3, 5) returns -1", async () =>
    expect(await run(app(($) => $.compare(3, 5)))).toBe(-1));
  it("compare(5, 5) returns 0", async () => expect(await run(app(($) => $.compare(5, 5)))).toBe(0));
  it("compare(5, 3) returns 1", async () => expect(await run(app(($) => $.compare(5, 3)))).toBe(1));
});

describe("ord interpreter: derived comparisons", () => {
  it("gt true", async () => expect(await run(app(($) => $.gt(5, 3)))).toBe(true));
  it("gt false", async () => expect(await run(app(($) => $.gt(3, 5)))).toBe(false));
  it("gt equal", async () => expect(await run(app(($) => $.gt(5, 5)))).toBe(false));
  it("gte true", async () => expect(await run(app(($) => $.gte(5, 5)))).toBe(true));
  it("gte false", async () => expect(await run(app(($) => $.gte(3, 5)))).toBe(false));
  it("lt true", async () => expect(await run(app(($) => $.lt(3, 5)))).toBe(true));
  it("lt false", async () => expect(await run(app(($) => $.lt(5, 3)))).toBe(false));
  it("lte true", async () => expect(await run(app(($) => $.lte(5, 5)))).toBe(true));
  it("lte false", async () => expect(await run(app(($) => $.lte(5, 3)))).toBe(false));
});

describe("ord interpreter: with input", () => {
  it("$.gt($.input.x, $.input.y)", async () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.gt($.input.x, $.input.y));
    expect(await run(prog, { x: 10, y: 5 })).toBe(true);
    expect(await run(prog, { x: 5, y: 10 })).toBe(false);
  });
});
