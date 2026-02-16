import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodLiteralBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("literal schemas (#107)", () => {
  it("$.zod.literal() returns a ZodLiteralBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.literal("tuna");
      expect(builder).toBeInstanceOf(ZodLiteralBuilder);
      return builder.parse(42);
    });
  });

  it("single string literal produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.literal("tuna").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/literal");
    expect(ast.result.schema.value).toBe("tuna");
  });

  it("single number literal produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.literal(42).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/literal");
    expect(ast.result.schema.value).toBe(42);
  });

  it("single boolean literal produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.literal(true).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/literal");
    expect(ast.result.schema.value).toBe(true);
  });

  it("multi-value literal produces array in AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.literal(["red", "green", "blue"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/literal");
    expect(ast.result.schema.value).toEqual(["red", "green", "blue"]);
  });

  it("literal inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.literal("tuna").optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/literal");
    expect(ast.result.schema.inner.value).toBe("tuna");
  });

  it("literal inherits refinement methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .literal("tuna")
        .refine((val) => val, { error: "must be tuna" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(1);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
  });
});
