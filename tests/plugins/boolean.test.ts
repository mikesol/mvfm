import { describe, expect, it } from "vitest";
import { ilo } from "../../src/core";
import { boolean } from "../../src/plugins/boolean";
import { eq } from "../../src/plugins/eq";
import { num } from "../../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(num, boolean, eq);

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

describe("boolean: trait declaration", () => {
  it("declares eq trait", () => {
    expect(boolean.traits?.eq).toEqual({ type: "boolean", nodeKind: "boolean/eq" });
    expect(boolean.nodeKinds).toContain("boolean/eq");
  });
});
