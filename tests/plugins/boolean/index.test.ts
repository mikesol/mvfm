import { describe, expect, it } from "vitest";
import { mvfm } from "../../../src/core";
import { boolean } from "../../../src/plugins/boolean";
import { eq } from "../../../src/plugins/eq";
import { heytingAlgebra } from "../../../src/plugins/heyting-algebra";
import { num } from "../../../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = mvfm(num, boolean, eq, heytingAlgebra);

describe("boolean: $.and()", () => {
  it("produces boolean/and", () => {
    const prog = app({ x: "number", y: "number" }, ($) =>
      $.and($.eq($.input.x, 1), $.eq($.input.y, 2)),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/and");
    expect(ast.result.left.kind).toBe("num/eq");
    expect(ast.result.right.kind).toBe("num/eq");
  });
});

describe("boolean: $.or()", () => {
  it("produces boolean/or", () => {
    const prog = app({ x: "number", y: "number" }, ($) =>
      $.or($.eq($.input.x, 1), $.eq($.input.y, 2)),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/or");
    expect(ast.result.left.kind).toBe("num/eq");
    expect(ast.result.right.kind).toBe("num/eq");
  });
});

describe("boolean: $.not()", () => {
  it("produces boolean/not", () => {
    const prog = app({ x: "number" }, ($) => $.not($.eq($.input.x, 1)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/not");
    expect(ast.result.operand.kind).toBe("num/eq");
  });
});

describe("boolean: trait declarations", () => {
  it("declares eq trait", () => {
    expect(boolean.traits?.eq).toEqual({ type: "boolean", nodeKinds: { eq: "boolean/eq" } });
    expect(boolean.nodeKinds).toContain("boolean/eq");
  });

  it("declares heytingAlgebra trait", () => {
    expect(boolean.traits?.heytingAlgebra).toBeDefined();
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.conj).toBe("boolean/and");
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.disj).toBe("boolean/or");
    expect(boolean.traits?.heytingAlgebra?.nodeKinds.not).toBe("boolean/not");
  });

  it("declares show trait", () => {
    expect(boolean.traits?.show).toEqual({ type: "boolean", nodeKinds: { show: "boolean/show" } });
    expect(boolean.nodeKinds).toContain("boolean/show");
  });

  it("declares bounded trait", () => {
    expect(boolean.traits?.bounded).toEqual({
      type: "boolean",
      nodeKinds: { top: "boolean/top", bottom: "boolean/bottom" },
    });
    expect(boolean.nodeKinds).toContain("boolean/top");
    expect(boolean.nodeKinds).toContain("boolean/bottom");
  });
});
