import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { boolean } from "../../../src/plugins/boolean";
import { num } from "../../../src/plugins/num";
import { show } from "../../../src/plugins/show";
import { str } from "../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("show: dispatch", () => {
  const app = ilo(num, str, boolean, show);

  it("$.show(number) dispatches to num/show", () => {
    const prog = app(($) => $.show(42));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/show");
    expect(ast.result.operand.kind).toBe("core/literal");
    expect(ast.result.operand.value).toBe(42);
  });

  it("$.show(string) dispatches to str/show", () => {
    const prog = app(($) => $.show("hello"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/show");
  });

  it("$.show(boolean) dispatches to boolean/show", () => {
    const prog = app(($) => $.show(true));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/show");
  });

  it("$.show with schema input dispatches correctly", () => {
    const prog = app({ x: "number" }, ($) => $.show($.input.x));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/show");
  });
});

describe("show: error cases", () => {
  it("throws when no show impl for inferred type", () => {
    const app = ilo(show);
    expect(() => app(($) => ($ as any).show(42))).toThrow(/No show implementation for type/);
  });
});
