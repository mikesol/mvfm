import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodStringboolBuilder, zod } from "../src/index";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("stringbool schemas (#156)", () => {
  it("$.zod.stringbool() returns a ZodStringboolBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.stringbool();
      expect(builder).toBeInstanceOf(ZodStringboolBuilder);
      return builder.parse(42);
    });
  });

  it("produces correct AST with defaults", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
  });

  it("produces correct AST with custom truthy/falsy", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool({ truthy: ["yep"], falsy: ["nah"] }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.truthy).toEqual(["yep"]);
    expect(ast.result.schema.falsy).toEqual(["nah"]);
  });

  it("produces correct AST with coerce option", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool({ coerce: false }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.coerce).toBe(false);
  });

  it("inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/stringbool");
  });
});
