import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
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

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, strInterpreter]);
  return interp(ast.result);
}

const app = ilo(str);

describe("str interpreter", () => {
  it("concat", () => expect(run(app(($) => $.concat("hello", " ", "world")))).toBe("hello world"));
  it("upper", () => expect(run(app(($) => $.upper("hello")))).toBe("HELLO"));
  it("lower", () => expect(run(app(($) => $.lower("HELLO")))).toBe("hello"));
  it("trim", () => expect(run(app(($) => $.trim("  hi  ")))).toBe("hi"));
  it("slice", () => expect(run(app(($) => $.slice("hello", 1, 3)))).toBe("el"));
  it("includes true", () => expect(run(app(($) => $.includes("hello world", "world")))).toBe(true));
  it("includes false", () => expect(run(app(($) => $.includes("hello world", "xyz")))).toBe(false));
  it("startsWith", () => expect(run(app(($) => $.startsWith("hello", "hel")))).toBe(true));
  it("endsWith", () => expect(run(app(($) => $.endsWith("hello", "llo")))).toBe(true));
  it("len", () => expect(run(app(($) => $.len("hello")))).toBe(5));
  it("replace", () =>
    expect(run(app(($) => $.replace("hello world", "world", "ilo")))).toBe("hello ilo"));

  it("with input", () => {
    const prog = app({ name: "string" }, ($) => $.upper($.input.name));
    expect(run(prog, { name: "alice" })).toBe("ALICE");
  });
});

describe("str interpreter: show", () => {
  it("str/show passes through string value", () => {
    const ast = {
      kind: "str/show",
      operand: { kind: "core/literal", value: "hello", __id: "t" },
    };
    const interp = composeInterpreters([coreInterpreter, strInterpreter]);
    expect(interp(ast)).toBe("hello");
  });
});

describe("str interpreter: semigroup", () => {
  it("str/append concatenates two strings", () => {
    const ast = {
      kind: "str/append",
      left: { kind: "core/literal", value: "foo", __id: "t1" },
      right: { kind: "core/literal", value: "bar", __id: "t2" },
    };
    const interp = composeInterpreters([coreInterpreter, strInterpreter]);
    expect(interp(ast)).toBe("foobar");
  });
});

describe("str interpreter: monoid", () => {
  it("str/mempty returns empty string", () => {
    const ast = { kind: "str/mempty" };
    const interp = composeInterpreters([coreInterpreter, strInterpreter]);
    expect(interp(ast)).toBe("");
  });
});
