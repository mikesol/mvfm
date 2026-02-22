import { isCExpr } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodTransformBuilder, ZodWrappedBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("transform/pipe/preprocess methods (#118)", () => {
  it(".transform(fn) produces zod/transform wrapper with lambda", () => {
    const schema = schemaOf($.zod.string().transform((val) => val));
    expect(schema.kind).toBe("zod/transform");
    expect(schema.inner.kind).toBe("zod/string");
    // In new system, fn is { param, body } with CExpr values
    expect(schema.fn).toBeDefined();
    expect(isCExpr(schema.fn.param)).toBe(true);
    expect(isCExpr(schema.fn.body)).toBe(true);
  });

  it(".transform(fn) returns ZodWrappedBuilder", () => {
    expect($.zod.string().transform((val) => val)).toBeInstanceOf(ZodWrappedBuilder);
  });

  it(".pipe(target) produces zod/pipe wrapper with target schema", () => {
    const schema = schemaOf($.zod.string().pipe($.zod.string()));
    expect(schema.kind).toBe("zod/pipe");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.target.kind).toBe("zod/string");
  });

  it("$.zod.transform(fn) produces standalone transform AST", () => {
    const schema = schemaOf($.zod.transform((val) => val));
    expect(schema.kind).toBe("zod/transform");
    expect(schema.fn).toBeDefined();
    // Standalone transform has no inner
    expect(schema.inner).toBeUndefined();
  });

  it("$.zod.transform(fn) returns ZodTransformBuilder", () => {
    expect($.zod.transform((val) => val)).toBeInstanceOf(ZodTransformBuilder);
  });

  it("$.zod.preprocess(fn, schema) produces zod/preprocess wrapper", () => {
    const schema = schemaOf($.zod.preprocess((val) => val, $.zod.string()));
    expect(schema.kind).toBe("zod/preprocess");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.fn).toBeDefined();
    expect(isCExpr(schema.fn.param)).toBe(true);
  });

  it("chained transforms nest correctly", () => {
    const schema = schemaOf(
      $.zod
        .string()
        .transform((val) => val)
        .transform((val) => val),
    );
    // Outer transform wraps inner transform wraps string
    expect(schema.kind).toBe("zod/transform");
    expect(schema.inner.kind).toBe("zod/transform");
    expect(schema.inner.inner.kind).toBe("zod/string");
  });

  it(".transform(fn) preserves inner schema checks", () => {
    const schema = schemaOf(
      $.zod
        .string()
        .min(3)
        .transform((val) => val),
    );
    expect(schema.kind).toBe("zod/transform");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.inner.checks).toHaveLength(1);
    expect(schema.inner.checks[0].kind).toBe("min_length");
  });
});
