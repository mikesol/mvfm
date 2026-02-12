import { describe, expect, it } from "vitest";
import { ilo } from "../../../src/core";
import { num } from "../../../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(num);

describe("num: binary operations", () => {
  it.each([
    ["sub", "num/sub"],
    ["div", "num/div"],
    ["mod", "num/mod"],
  ] as const)("$.%s produces %s node", (method, kind) => {
    const prog = app(($) => ($[method] as any)($.input.a, $.input.b));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
    expect(ast.result.left.kind).toBe("core/prop_access");
    expect(ast.result.right.kind).toBe("core/prop_access");
  });
});

describe("num: unary operations", () => {
  it.each([
    ["neg", "num/neg"],
    ["abs", "num/abs"],
    ["floor", "num/floor"],
    ["ceil", "num/ceil"],
    ["round", "num/round"],
  ] as const)("$.%s produces %s node", (method, kind) => {
    const prog = app(($) => ($[method] as any)($.input.x));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe(kind);
    expect(ast.result.operand.kind).toBe("core/prop_access");
  });
});

describe("num: variadic operations", () => {
  it("$.min produces num/min with values array", () => {
    const prog = app(($) => $.min($.input.a, $.input.b, 0));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/min");
    expect(ast.result.values).toHaveLength(3);
    expect(ast.result.values[2].kind).toBe("core/literal");
  });

  it("$.max produces num/max with values array", () => {
    const prog = app(($) => $.max($.input.a, 100));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("num/max");
    expect(ast.result.values).toHaveLength(2);
  });
});

describe("num: auto-lifting", () => {
  it("lifts raw numbers on both sides", () => {
    const prog = app(($) => $.sub(1, 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/literal");
    expect(ast.result.left.value).toBe(1);
    expect(ast.result.right.kind).toBe("core/literal");
    expect(ast.result.right.value).toBe(2);
  });

  it("passes through Expr values without wrapping", () => {
    const prog = app(($) => $.sub($.input.x, 1));
    const ast = strip(prog.ast) as any;
    expect(ast.result.left.kind).toBe("core/prop_access");
    expect(ast.result.right.kind).toBe("core/literal");
  });
});

describe("num: trait declarations", () => {
  it("declares eq trait", () => {
    expect(num.traits?.eq).toEqual({ type: "number", nodeKinds: { eq: "num/eq" } });
    expect(num.nodeKinds).toContain("num/eq");
  });

  it("declares ord trait", () => {
    expect(num.traits?.ord).toEqual({ type: "number", nodeKinds: { compare: "num/compare" } });
    expect(num.nodeKinds).toContain("num/compare");
  });

  it("declares semiring trait", () => {
    expect(num.traits?.semiring).toEqual({
      type: "number",
      nodeKinds: { add: "num/add", zero: "num/zero", mul: "num/mul", one: "num/one" },
    });
    expect(num.nodeKinds).toContain("num/add");
    expect(num.nodeKinds).toContain("num/mul");
  });
});
