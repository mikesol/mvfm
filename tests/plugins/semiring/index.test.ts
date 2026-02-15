import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { num } from "../../../src/plugins/num";
import { semiring } from "../../../src/plugins/semiring";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("semiring: dispatch to num", () => {
  const app = mvfm(num, semiring);

  it("$.add(literal, literal) dispatches to num/add", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.value).toBe(2);
  });

  it("$.mul(literal, literal) dispatches to num/mul", () => {
    const prog = app(($) => $.mul(3, 4));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/mul");
  });

  it("$.add with schema input dispatches to num/add", () => {
    const prog = app({ x: "number" }, ($) => $.add($.input.x, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
  });

  it("auto-lifts raw numbers", () => {
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.right.kind).toBe("core/literal");
  });
});

describe("semiring: error cases", () => {
  it("throws when no semiring impl for inferred type", () => {
    const app = mvfm(semiring);
    expect(() => app(($) => ($ as any).add(1, 2))).toThrow(/No semiring implementation for type/);
  });
});
