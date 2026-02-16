import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { eq } from "../../../src/plugins/eq";
import { heytingAlgebra } from "../../../src/plugins/heyting-algebra";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...numInterpreter, ...booleanInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}

const app = mvfm(num, boolean, eq, heytingAlgebra);

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
