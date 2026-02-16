import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { semiring } from "../../../src/plugins/semiring";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...numInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
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
