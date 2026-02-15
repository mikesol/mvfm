import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { num } from "../../../src/plugins/num";
import { ord } from "../../../src/plugins/ord";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("ord: compare dispatch", () => {
  const app = mvfm(num, ord);

  it("$.compare(literal, literal) dispatches to num/compare", () => {
    const prog = app(($) => $.compare(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/compare");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.value).toBe(2);
  });

  it("$.compare with schema input dispatches to num/compare", () => {
    const prog = app({ x: "number" }, ($) => $.compare($.input.x, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/compare");
  });
});

describe("ord: derived operations wrap compare", () => {
  const app = mvfm(num, ord);

  it.each([
    ["gt", "ord/gt"],
    ["gte", "ord/gte"],
    ["lt", "ord/lt"],
    ["lte", "ord/lte"],
  ] as const)("$.%s wraps num/compare in %s", (method, kind) => {
    const prog = app(($) => ($[method] as any)(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
    expect(ast.result.operand.kind).toBe("num/compare");
    expect(ast.result.operand.left.value).toBe(1);
    expect(ast.result.operand.right.value).toBe(2);
  });

  it("$.gt with schema input dispatches correctly", () => {
    const prog = app({ x: "number" }, ($) => $.gt($.input.x, 10));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("ord/gt");
    expect(ast.result.operand.kind).toBe("num/compare");
  });
});

describe("ord: error cases", () => {
  it("throws when no ord impl for inferred type", () => {
    const app = mvfm(ord);
    expect(() => app(($) => ($ as any).gt(1, 2))).toThrow(/No ord implementation for type/);
  });
});
