import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { semigroup } from "../../../src/plugins/semigroup";
import { str } from "../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("semigroup: dispatch to str", () => {
  const app = ilo(str, semigroup);

  it("$.append(literal, literal) dispatches to str/append", () => {
    const prog = app(($) => $.append("foo", "bar"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/append");
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.left.value).toBe("foo");
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe("bar");
  });

  it("$.append with schema input dispatches to str/append", () => {
    const prog = app({ x: "string" }, ($) => $.append($.input.x, "!"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/append");
  });

  it("auto-lifts raw strings", () => {
    const prog = app(($) => $.append("a", "b"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.right.kind).toBe("core/literal");
  });
});

describe("semigroup: error cases", () => {
  it("throws when no semigroup impl for inferred type", () => {
    const app = ilo(semigroup);
    expect(() => app(($) => $.append("a", "b"))).toThrow(/No semigroup implementation for type/);
  });
});
