import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../../src/core";
import { coreInterpreter } from "../../../src/interpreters/core";
import { boolean } from "../../../src/plugins/boolean";
import { booleanInterpreter } from "../../../src/plugins/boolean/interpreter";
import { eq } from "../../../src/plugins/eq";
import { eqInterpreter } from "../../../src/plugins/eq/interpreter";
import { num } from "../../../src/plugins/num";
import { numInterpreter } from "../../../src/plugins/num/interpreter";
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

const fragments = [
  coreInterpreter,
  numInterpreter,
  strInterpreter,
  booleanInterpreter,
  eqInterpreter,
];

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters(fragments);
  return interp(ast.result);
}

describe("eq interpretation: numbers", () => {
  const app = ilo(num, eq);

  it("equal numbers -> true", () => {
    const prog = app(($) => $.eq(42, 42));
    expect(run(prog)).toBe(true);
  });

  it("unequal numbers -> false", () => {
    const prog = app(($) => $.eq(42, 99));
    expect(run(prog)).toBe(false);
  });

  it("with input", () => {
    const prog = app({ x: "number", y: "number" }, ($) => $.eq($.input.x, $.input.y));
    expect(run(prog, { x: 5, y: 5 })).toBe(true);
    expect(run(prog, { x: 5, y: 6 })).toBe(false);
  });
});

describe("eq interpretation: strings", () => {
  const app = ilo(str, eq);

  it("equal strings -> true", () => {
    const prog = app(($) => $.eq("hello", "hello"));
    expect(run(prog)).toBe(true);
  });

  it("unequal strings -> false", () => {
    const prog = app(($) => $.eq("hello", "world"));
    expect(run(prog)).toBe(false);
  });

  it("with input", () => {
    const prog = app({ name: "string" }, ($) => $.eq($.input.name, "alice"));
    expect(run(prog, { name: "alice" })).toBe(true);
    expect(run(prog, { name: "bob" })).toBe(false);
  });
});

describe("eq interpretation: booleans", () => {
  const app = ilo(boolean, eq);

  it("equal booleans -> true", () => {
    const prog = app(($) => $.eq(true, true));
    expect(run(prog)).toBe(true);
  });

  it("unequal booleans -> false", () => {
    const prog = app(($) => $.eq(true, false));
    expect(run(prog)).toBe(false);
  });
});

describe("eq + cond interpretation: end-to-end", () => {
  const app = ilo(num, str, eq);

  it("cond(eq(input.x, 1)).t('one').f('other') with x=1", () => {
    const prog = app({ x: "number" }, ($) => $.cond($.eq($.input.x, 1)).t("one").f("other"));
    expect(run(prog, { x: 1 })).toBe("one");
    expect(run(prog, { x: 2 })).toBe("other");
  });

  it("cond(eq(input.name, 'alice')).t('found').f('not found')", () => {
    const prog = app({ name: "string" }, ($) =>
      $.cond($.eq($.input.name, "alice")).t("found").f("not found"),
    );
    expect(run(prog, { name: "alice" })).toBe("found");
    expect(run(prog, { name: "bob" })).toBe("not found");
  });
});

describe("eq interpretation: neq", () => {
  const app = ilo(num, eq);

  it("neq(1, 2) returns true", () => {
    const prog = app(($) => $.neq(1, 2));
    expect(run(prog)).toBe(true);
  });

  it("neq(42, 42) returns false", () => {
    const prog = app(($) => $.neq(42, 42));
    expect(run(prog)).toBe(false);
  });
});
