import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodObjectBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

const app = mvfm(zod);

describe("object schemas (#109)", () => {
  it("$.zod.object() returns ZodObjectBuilder", () => {
    app(($) => {
      const builder = $.zod.object({ name: $.zod.string() });
      expect(builder).toBeInstanceOf(ZodObjectBuilder);
      return builder.parse($.input);
    });
  });

  it("object produces correct AST with shape", () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string(), age: $.zod.string().min(1) }).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    expect(ast.result.schema.mode).toBe("strip");
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.age.kind).toBe("zod/string");
    expect(ast.result.schema.shape.age.checks).toHaveLength(1);
  });

  it("object accepts error param", () => {
    const prog = app(($) => $.zod.object({ x: $.zod.string() }, "Bad object!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad object!");
  });

  it("strictObject sets mode to strict", () => {
    const prog = app(($) => $.zod.strictObject({ name: $.zod.string() }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.mode).toBe("strict");
  });

  it("looseObject sets mode to loose", () => {
    const prog = app(($) => $.zod.looseObject({ name: $.zod.string() }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.mode).toBe("loose");
  });

  it("pick() selects specific fields", () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.string() })
        .pick({ name: true })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(Object.keys(ast.result.schema.shape)).toEqual(["name"]);
  });

  it("omit() removes specific fields", () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.string() })
        .omit({ age: true })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(Object.keys(ast.result.schema.shape)).toEqual(["name"]);
  });

  it("partial() wraps all fields with optional", () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).partial().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.shape.name.kind).toBe("zod/optional");
    expect(ast.result.schema.shape.name.inner.kind).toBe("zod/string");
  });

  it("partial() with mask wraps only specified fields", () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.string() })
        .partial({ name: true })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.shape.name.kind).toBe("zod/optional");
    expect(ast.result.schema.shape.age.kind).toBe("zod/string");
  });

  it("required() unwraps optional fields", () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }).partial().required().parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
  });

  it("required() with mask unwraps only specified fields", () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.string() })
        .partial()
        .required({ name: true })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.shape.name.kind).toBe("zod/string");
    expect(ast.result.schema.shape.age.kind).toBe("zod/optional");
  });

  it("extend() adds fields to shape", () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }).extend({ age: $.zod.string() }).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(Object.keys(ast.result.schema.shape)).toEqual(["name", "age"]);
  });

  it("catchall() sets catchall schema in AST", () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }).catchall($.zod.string()).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.catchall).toBeDefined();
    expect(ast.result.schema.catchall.kind).toBe("zod/string");
  });

  it("object supports wrappers", () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/object");
  });

  it("immutable chaining: operations do not mutate original", () => {
    const prog = app(($) => {
      const base = $.zod.object({ name: $.zod.string() });
      const extended = base.extend({ age: $.zod.string() });
      expect(base).not.toBe(extended);
      return extended.parse($.input);
    });
    expect(prog).toBeDefined();
  });
});
