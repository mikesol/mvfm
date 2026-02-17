import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodStringboolBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("stringbool schemas (#119)", () => {
  it("$.zod.stringbool() returns a ZodStringboolBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.stringbool();
      expect(builder).toBeInstanceOf(ZodStringboolBuilder);
      return builder.parse("true");
    });
  });

  it("stringbool with default options produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.truthy).toBeUndefined();
    expect(ast.result.schema.falsy).toBeUndefined();
    expect(ast.result.schema.caseSensitive).toBe(false);
  });

  it("stringbool with custom truthy values produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .stringbool({
          truthy: ["yes", "y", "1"],
          falsy: ["no", "n", "0"],
        })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.truthy).toEqual(["yes", "y", "1"]);
    expect(ast.result.schema.falsy).toEqual(["no", "n", "0"]);
  });

  it("stringbool with case sensitive option produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .stringbool({
          case: "sensitive",
        })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.caseSensitive).toBe(true);
  });

  it("stringbool with custom error message", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .stringbool({
          error: "custom error",
        })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/stringbool");
    expect(ast.result.schema.error).toBe("custom error");
  });

  it("stringbool inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.stringbool().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/stringbool");
  });

  it("stringbool inherits refinement methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .stringbool()
        .refine((val) => val, { error: "must be true" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(1);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
  });
});
