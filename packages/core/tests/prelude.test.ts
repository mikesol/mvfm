import { describe, expect, expectTypeOf, it } from "vitest";
import type { Expr } from "../src";
import { mvfm, prelude } from "../src";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("core prelude", () => {
  it("supports mvfm(prelude)", () => {
    const app = mvfm(prelude);
    const prog = app(($) => $.add(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/add");
  });

  it("supports mvfm(...prelude)", () => {
    const app = mvfm(...prelude);
    const prog = app(($) => $.eq("a", "a"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toMatch(/^str\/eq|num\/eq|boolean\/eq$/);
  });

  it("provides typed methods from included plugins", () => {
    const app = mvfm(prelude);
    app(($) => {
      const n = $.add(1, 2);
      const cmp = $.gt(3, 1);
      const s = $.show(true);
      const joined = $.append("a", "b");

      expectTypeOf(n).toEqualTypeOf<Expr<number>>();
      expectTypeOf(cmp).toEqualTypeOf<Expr<boolean>>();
      expectTypeOf(s).toEqualTypeOf<Expr<string>>();
      expectTypeOf(joined).toEqualTypeOf<Expr<string>>();

      return $.begin(n, cmp, s, joined);
    });
  });
});
