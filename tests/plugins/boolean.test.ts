import { describe, expect, it } from "vitest";
import { ilo } from "../../src/core";
import { boolean } from "../../src/plugins/boolean";
import { num } from "../../src/plugins/num";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = ilo(num, boolean);

describe("boolean: $.and()", () => {
  it("produces boolean/and", () => {
    const prog = app(($) => $.and($.eq($.input.x, 1), $.eq($.input.y, 2)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/and");
    expect(ast.result.left.kind).toBe("core/eq");
    expect(ast.result.right.kind).toBe("core/eq");
  });
});

describe("boolean: $.or()", () => {
  it("produces boolean/or", () => {
    const prog = app(($) => $.or($.eq($.input.x, 1), $.eq($.input.y, 2)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/or");
    expect(ast.result.left.kind).toBe("core/eq");
    expect(ast.result.right.kind).toBe("core/eq");
  });
});

describe("boolean: $.not()", () => {
  it("produces boolean/not", () => {
    const prog = app(($) => $.not($.eq($.input.x, 1)));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("boolean/not");
    expect(ast.result.operand.kind).toBe("core/eq");
  });
});
