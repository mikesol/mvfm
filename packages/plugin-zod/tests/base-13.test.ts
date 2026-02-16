import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodTransformBuilder, ZodWrappedBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("transform/pipe/preprocess methods (#118)", () => {
  it(".transform(fn) produces zod/transform wrapper with lambda", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .transform((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/transform");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.fn.kind).toBe("core/lambda");
    expect(ast.result.schema.fn.param.kind).toBe("core/lambda_param");
    expect(ast.result.schema.fn.param.name).toBe("transform_val");
  });

  it(".transform(fn) returns ZodWrappedBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const wrapped = $.zod.string().transform((val) => val);
      expect(wrapped).toBeInstanceOf(ZodWrappedBuilder);
      return wrapped.parse($.input);
    });
  });

  it(".pipe(target) produces zod/pipe wrapper with target schema", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().pipe($.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/pipe");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.target.kind).toBe("zod/string");
  });

  it("$.zod.transform(fn) produces standalone transform AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.transform((val) => val).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/transform");
    expect(ast.result.schema.fn.kind).toBe("core/lambda");
    expect(ast.result.schema.fn.param.name).toBe("transform_val");
    // Standalone transform has no inner
    expect(ast.result.schema.inner).toBeUndefined();
  });

  it("$.zod.transform(fn) returns ZodTransformBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.transform((val) => val);
      expect(builder).toBeInstanceOf(ZodTransformBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.preprocess(fn, schema) produces zod/preprocess wrapper", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.preprocess((val) => val, $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/preprocess");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.fn.kind).toBe("core/lambda");
    expect(ast.result.schema.fn.param.name).toBe("preprocess_val");
  });

  it("chained transforms nest correctly", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .transform((val) => val)
        .transform((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    // Outer transform wraps inner transform wraps string
    expect(ast.result.schema.kind).toBe("zod/transform");
    expect(ast.result.schema.inner.kind).toBe("zod/transform");
    expect(ast.result.schema.inner.inner.kind).toBe("zod/string");
  });

  it(".transform(fn) preserves inner schema checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .min(3)
        .transform((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/transform");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.inner.checks).toHaveLength(1);
    expect(ast.result.schema.inner.checks[0].kind).toBe("min_length");
  });
});
