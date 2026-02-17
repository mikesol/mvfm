import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodDiscriminatedUnionBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("discriminatedUnion schemas (#113)", () => {
  it("$.zod.discriminatedUnion() returns a ZodDiscriminatedUnionBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.discriminatedUnion("status", [
        $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
        $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
      ]);
      expect(builder).toBeInstanceOf(ZodDiscriminatedUnionBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.discriminatedUnion() produces zod/discriminated_union AST with discriminator and options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .discriminatedUnion("status", [
          $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
          $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
        ])
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/discriminated_union");
    expect(ast.result.schema.discriminator).toBe("status");
    expect(ast.result.schema.options).toHaveLength(2);
    expect(ast.result.schema.options[0].kind).toBe("zod/object");
    expect(ast.result.schema.options[1].kind).toBe("zod/object");
  });

  it("$.zod.discriminatedUnion() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .discriminatedUnion(
          "type",
          [$.zod.object({ type: $.zod.literal("a") }), $.zod.object({ type: $.zod.literal("b") })],
          "Bad discriminated union!",
        )
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad discriminated union!");
  });

  it("wrappers work on discriminated union schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .discriminatedUnion("kind", [
          $.zod.object({ kind: $.zod.literal("circle") }),
          $.zod.object({ kind: $.zod.literal("square") }),
        ])
        .optional()
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/discriminated_union");
    expect(ast.result.schema.inner.discriminator).toBe("kind");
  });

  it("nested discriminated unions are supported", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const inner = $.zod.discriminatedUnion("shape", [
        $.zod.object({ shape: $.zod.literal("circle"), radius: $.zod.number() }),
        $.zod.object({ shape: $.zod.literal("square"), side: $.zod.number() }),
      ]);
      return $.zod
        .discriminatedUnion("type", [
          $.zod.object({ type: $.zod.literal("geometry"), data: inner }),
          $.zod.object({ type: $.zod.literal("text"), content: $.zod.string() }),
        ])
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/discriminated_union");
    expect(ast.result.schema.discriminator).toBe("type");
    // Check that one of the options contains a nested discriminated union
    const geometryOption = ast.result.schema.options[0];
    const dataField = geometryOption.shape.data;
    expect(dataField.kind).toBe("zod/discriminated_union");
    expect(dataField.discriminator).toBe("shape");
  });
});
