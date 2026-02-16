import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
import { show } from "../../../src/plugins/show";
import { str } from "../../../src/plugins/str";
import { strInterpreter } from "../../../src/plugins/str/interpreter";
import type { Program } from "../../../src/types";

const combined = {
  ...coreInterpreter,
  ...numInterpreter,
  ...strInterpreter,
  ...booleanInterpreter,
};

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}

const app = mvfm(num, str, boolean, show);

describe("show interpreter", () => {
  it("show(42) returns '42'", async () => {
    expect(await run(app(($) => $.show(42)))).toBe("42");
  });

  it("show(3.14) returns '3.14'", async () => {
    expect(await run(app(($) => $.show(3.14)))).toBe("3.14");
  });

  it("show(true) returns 'true'", async () => {
    expect(await run(app(($) => $.show(true)))).toBe("true");
  });

  it("show(false) returns 'false'", async () => {
    expect(await run(app(($) => $.show(false)))).toBe("false");
  });

  it("show('hello') returns 'hello'", async () => {
    expect(await run(app(($) => $.show("hello")))).toBe("hello");
  });

  it("show with input", async () => {
    const prog = app({ x: "number" }, ($) => $.show($.input.x));
    expect(await run(prog, { x: 99 })).toBe("99");
  });
});
