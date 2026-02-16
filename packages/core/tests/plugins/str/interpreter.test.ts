import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { foldAST } from "../../../src/fold";
import { injectInput } from "../../../src/inject";
import { coreInterpreter } from "../../../src/interpreters/core";
import { str } from "../../../src/plugins/str";
import { strInterpreter } from "../../../src/plugins/str/interpreter";
import type { Program } from "../../../src/types";

const combined = { ...coreInterpreter, ...strInterpreter };

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(combined, injectInput(prog, input));
}

const app = mvfm(str);

describe("str interpreter", () => {
  it("concat", async () =>
    expect(await run(app(($) => $.concat("hello", " ", "world")))).toBe("hello world"));
  it("upper", async () => expect(await run(app(($) => $.upper("hello")))).toBe("HELLO"));
  it("lower", async () => expect(await run(app(($) => $.lower("HELLO")))).toBe("hello"));
  it("trim", async () => expect(await run(app(($) => $.trim("  hi  ")))).toBe("hi"));
  it("slice", async () => expect(await run(app(($) => $.slice("hello", 1, 3)))).toBe("el"));
  it("includes true", async () =>
    expect(await run(app(($) => $.includes("hello world", "world")))).toBe(true));
  it("includes false", async () =>
    expect(await run(app(($) => $.includes("hello world", "xyz")))).toBe(false));
  it("startsWith", async () =>
    expect(await run(app(($) => $.startsWith("hello", "hel")))).toBe(true));
  it("endsWith", async () => expect(await run(app(($) => $.endsWith("hello", "llo")))).toBe(true));
  it("len", async () => expect(await run(app(($) => $.len("hello")))).toBe(5));
  it("replace", async () =>
    expect(await run(app(($) => $.replace("hello world", "world", "mvfm")))).toBe("hello mvfm"));

  it("with input", async () => {
    const prog = app({ name: "string" }, ($) => $.upper($.input.name));
    expect(await run(prog, { name: "alice" })).toBe("ALICE");
  });
});

describe("str interpreter: show", () => {
  it("str/show passes through string value", async () => {
    const ast = {
      kind: "str/show",
      operand: { kind: "core/literal", value: "hello", __id: "t" },
    };
    expect(await foldAST(combined, ast)).toBe("hello");
  });
});

describe("str interpreter: semigroup", () => {
  it("str/append concatenates two strings", async () => {
    const ast = {
      kind: "str/append",
      left: { kind: "core/literal", value: "foo", __id: "t1" },
      right: { kind: "core/literal", value: "bar", __id: "t2" },
    };
    expect(await foldAST(combined, ast)).toBe("foobar");
  });
});

describe("str interpreter: monoid", () => {
  it("str/mempty returns empty string", async () => {
    expect(await foldAST(combined, { kind: "str/mempty" })).toBe("");
  });
});
