import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { semigroup } from "../../../src/plugins/semigroup";
import { str } from "../../../src/plugins/str";
import { strInterpreter } from "../../../src/plugins/str/interpreter";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...strInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
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
