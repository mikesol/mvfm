import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { boolean } from "../../../src/plugins/boolean";
import { eq } from "../../../src/plugins/eq";
import { num } from "../../../src/plugins/num";
import { semiring } from "../../../src/plugins/semiring";
import { str } from "../../../src/plugins/str";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("eq: dispatch to num/eq", () => {
  const app = mvfm(num, semiring, eq);

  it("$.eq(literal, literal) dispatches to num/eq", () => {
    const prog = app(($) => $.eq(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/eq");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.value).toBe(2);
  });

  it("$.eq(numExpr, literal) dispatches to num/eq", () => {
    const prog = app(($) => $.eq($.add(1, 2), 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/eq");
  });

  it("$.eq($.input.x, 1) dispatches to num/eq via schema", () => {
    const prog = app({ x: "number" }, ($) => $.eq($.input.x, 1));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/eq");
  });
});

describe("eq: dispatch to str/eq", () => {
  const app = mvfm(str, eq);

  it("$.eq(strLiteral, strLiteral) dispatches to str/eq", () => {
    const prog = app(($) => $.eq("hello", "world"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/eq");
  });

  it("$.eq($.input.name, 'alice') dispatches to str/eq via schema", () => {
    const prog = app({ name: "string" }, ($) => $.eq($.input.name, "alice"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/eq");
  });
});

describe("eq: dispatch to boolean/eq", () => {
  const app = mvfm(boolean, eq);

  it("$.eq(true, false) dispatches to boolean/eq", () => {
    const prog = app(($) => $.eq(true, false));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/eq");
  });

  it("$.eq($.input.active, true) dispatches to boolean/eq via schema", () => {
    const prog = app({ active: "boolean" }, ($) => $.eq($.input.active, true));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/eq");
  });
});

describe("eq: nested schema resolution", () => {
  const app = mvfm(num, str, eq);

  it("$.eq($.input.user.age, 30) walks nested schema", () => {
    const prog = app({ user: { age: "number", name: "string" } }, ($) =>
      $.eq($.input.user.age, 30),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/eq");
  });

  it("$.eq($.input.user.name, 'bob') walks nested schema for string", () => {
    const prog = app({ user: { age: "number", name: "string" } }, ($) =>
      $.eq($.input.user.name, "bob"),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("str/eq");
  });
});

describe("eq: error cases", () => {
  it("throws when no eq impl for inferred type", () => {
    const app = mvfm(eq);
    expect(() => app(($) => ($ as any).eq(1, 2))).toThrow(/No eq implementation for type/);
  });

  it("falls back to sole impl when both args are untyped (single provider)", () => {
    const app = mvfm(num, eq);
    // Only one eq provider (num) — falls back without type inference
    const prog = app(($) => $.eq($.input.x, $.input.y));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/eq");
  });

  it("throws when both args are untyped with multiple providers", () => {
    const app = mvfm(num, str, boolean, eq);
    // Multiple eq providers — can't disambiguate
    expect(() => app(($) => $.eq($.input.x, $.input.y))).toThrow(/Cannot infer type for eq/);
  });
});

describe("eq: neq dispatch", () => {
  const app = mvfm(num, eq);

  it("$.neq(literal, literal) wraps num/eq in eq/neq", () => {
    const prog = app(($) => $.neq(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("eq/neq");
    expect(ast.result.inner.kind).toBe("num/eq");
    expect(ast.result.inner.left.value).toBe(1);
    expect(ast.result.inner.right.value).toBe(2);
  });
});
