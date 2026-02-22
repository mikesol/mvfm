import { isCExpr } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { $, schemaOf } from "./test-helpers";

describe("refinement methods (#98)", () => {
  it("refine() produces refinement descriptor with lambda", () => {
    const schema = schemaOf($.zod.string().refine((val) => val));
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
    // In new system, fn is { param, body } with CExpr values
    expect(schema.refinements[0].fn).toBeDefined();
    expect(isCExpr(schema.refinements[0].fn.param)).toBe(true);
    expect(isCExpr(schema.refinements[0].fn.body)).toBe(true);
  });

  it("refine() captures predicate body AST", () => {
    const schema = schemaOf($.zod.string().refine((val) => val));
    const fn = schema.refinements[0].fn;
    // Body should reference the lambda param
    expect(fn.body).toBeDefined();
  });

  it("refine() accepts error/abort/path options", () => {
    const schema = schemaOf(
      $.zod.string().refine((val) => val, {
        error: "Must be valid!",
        abort: true,
        path: ["field", "sub"],
      }),
    );
    const refinement = schema.refinements[0];
    expect(refinement.error).toBe("Must be valid!");
    expect(refinement.abort).toBe(true);
    expect(refinement.path).toEqual(["field", "sub"]);
  });

  it("multiple refine() calls chain immutably", () => {
    const s1 = $.zod.string();
    const s2 = s1.refine((val) => val);
    const s3 = s2.refine((val) => val, { error: "second" });
    expect(s1).not.toBe(s2);
    expect(s2).not.toBe(s3);
    const schema = schemaOf(s3);
    expect(schema.refinements).toHaveLength(2);
    expect(schema.refinements[0].kind).toBe("refine");
    expect(schema.refinements[1].kind).toBe("refine");
    expect(schema.refinements[1].error).toBe("second");
  });

  it("superRefine() produces super_refine descriptor", () => {
    const schema = schemaOf($.zod.string().superRefine((val) => val));
    const refinement = schema.refinements[0];
    expect(refinement.kind).toBe("super_refine");
    expect(refinement.fn).toBeDefined();
    expect(isCExpr(refinement.fn.param)).toBe(true);
  });

  it("check() produces check descriptor", () => {
    const schema = schemaOf($.zod.string().check((val) => val));
    const refinement = schema.refinements[0];
    expect(refinement.kind).toBe("check");
    expect(refinement.fn).toBeDefined();
    expect(isCExpr(refinement.fn.param)).toBe(true);
  });

  it("overwrite() produces overwrite descriptor", () => {
    const schema = schemaOf($.zod.string().overwrite((val) => val));
    const refinement = schema.refinements[0];
    expect(refinement.kind).toBe("overwrite");
    expect(refinement.fn).toBeDefined();
    expect(isCExpr(refinement.fn.param)).toBe(true);
  });

  it("refinements coexist with checks", () => {
    const schema = schemaOf(
      $.zod
        .string()
        .min(3)
        .refine((val) => val, { error: "custom" })
        .max(100),
    );
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("min_length");
    expect(schema.checks[1].kind).toBe("max_length");
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
    expect(schema.refinements[0].error).toBe("custom");
  });

  it("superRefine() accepts error/abort options", () => {
    const schema = schemaOf(
      $.zod.string().superRefine((val) => val, { error: "super error", abort: true }),
    );
    const refinement = schema.refinements[0];
    expect(refinement.error).toBe("super error");
    expect(refinement.abort).toBe(true);
  });

  it("overwrite() accepts error/when options", () => {
    const schema = schemaOf($.zod.string().overwrite((val) => val, { error: "overwrite error" }));
    const refinement = schema.refinements[0];
    expect(refinement.error).toBe("overwrite error");
  });
});
