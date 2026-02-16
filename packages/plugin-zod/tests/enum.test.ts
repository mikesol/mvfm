import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodEnumBuilder, ZodNativeEnumBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("enum schemas (#108)", () => {
  it("$.zod.enum() returns a ZodEnumBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.enum(["Salmon", "Tuna"]);
      expect(builder).toBeInstanceOf(ZodEnumBuilder);
      return builder.parse($.input);
    });
  });

  it("enum produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.enum(["Salmon", "Tuna", "Trout"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/enum");
    expect(ast.result.schema.values).toEqual(["Salmon", "Tuna", "Trout"]);
  });

  it("enum accepts error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.enum(["a", "b"], "Invalid!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Invalid!");
  });

  it("extract() produces sub-enum", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.enum(["Salmon", "Tuna", "Trout"]).extract(["Salmon", "Trout"]).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/enum");
    expect(ast.result.schema.values).toEqual(["Salmon", "Trout"]);
  });

  it("exclude() removes values from enum", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.enum(["Salmon", "Tuna", "Trout"]).exclude(["Salmon"]).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/enum");
    expect(ast.result.schema.values).toEqual(["Tuna", "Trout"]);
  });

  it("enum supports wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.enum(["a", "b"]).optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/enum");
  });

  it("nativeEnum produces correct AST", () => {
    const app = mvfm(zod);
    const MyEnum = { Salmon: 0, Tuna: 1, Trout: 2 } as const;
    const prog = app(($) => $.zod.nativeEnum(MyEnum).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/native_enum");
    expect(ast.result.schema.entries).toEqual({ Salmon: 0, Tuna: 1, Trout: 2 });
  });

  it("$.zod.nativeEnum() returns a ZodNativeEnumBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.nativeEnum({ A: 0 });
      expect(builder).toBeInstanceOf(ZodNativeEnumBuilder);
      return builder.parse($.input);
    });
  });

  it("enum inherits refinement methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .enum(["a", "b"])
        .refine((val) => val, { error: "must be valid" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(1);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
  });
});
