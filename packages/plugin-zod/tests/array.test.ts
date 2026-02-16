import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodArrayBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("array schemas (#110)", () => {
  it("$.zod.array() returns a ZodArrayBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.array($.zod.string());
      expect(builder).toBeInstanceOf(ZodArrayBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.array() produces zod/array AST with element schema", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/array");
    expect(ast.result.schema.element).toBeDefined();
    expect(ast.result.schema.element.kind).toBe("zod/string");
  });

  it("$.zod.array() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string(), "Not an array!").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not an array!");
  });

  it("min() adds min_length check", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).min(3).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "min_length", value: 3 });
  });

  it("max() adds max_length check", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).max(10).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "max_length", value: 10 });
  });

  it("length() adds length check", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).length(5).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "length", value: 5 });
  });

  it("chained min + max checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).min(2).max(5).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "min_length", value: 2 });
    expect(ast.result.schema.checks[1]).toMatchObject({ kind: "max_length", value: 5 });
  });

  it("check accepts error option", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).min(1, { error: "Need at least one!" }).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0].error).toBe("Need at least one!");
  });

  it("nested arrays produce correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.array($.zod.string())).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/array");
    expect(ast.result.schema.element.kind).toBe("zod/array");
    expect(ast.result.schema.element.element.kind).toBe("zod/string");
  });

  it("immutable chaining — min() returns new instance", () => {
    const app = mvfm(zod);
    app(($) => {
      const a1 = $.zod.array($.zod.string());
      const a2 = a1.min(3);
      expect(a1).not.toBe(a2);
      return a2.parse($.input);
    });
  });

  it("wrappers work on array schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.array($.zod.string()).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/array");
    expect(ast.result.schema.inner.element.kind).toBe("zod/string");
  });
});
