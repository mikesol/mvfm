import { describe, expect, it } from "vitest";
import { ZodNumberBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("number schema (#102)", () => {
  it("$.zod.number() returns a ZodNumberBuilder", () => {
    expect($.zod.number()).toBeInstanceOf(ZodNumberBuilder);
  });

  it("$.zod.number() produces zod/number AST node", () => {
    const schema = schemaOf($.zod.number());
    expect(schema.kind).toBe("zod/number");
    expect(schema.checks).toEqual([]);
  });

  it("$.zod.number() accepts error param", () => {
    const schema = schemaOf($.zod.number("Not a number!"));
    expect(schema.error).toBe("Not a number!");
  });

  it("gt() adds gt check", () => {
    const schema = schemaOf($.zod.number().gt(5));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0]).toMatchObject({ kind: "gt", value: 5 });
  });

  it("gte() and min() are aliases", () => {
    const s1 = schemaOf($.zod.number().gte(10));
    const s2 = schemaOf($.zod.number().min(10));
    expect(s1.checks[0]).toMatchObject({ kind: "gte", value: 10 });
    expect(s2.checks[0]).toMatchObject({ kind: "gte", value: 10 });
  });

  it("lt() adds lt check", () => {
    const schema = schemaOf($.zod.number().lt(100));
    expect(schema.checks[0]).toMatchObject({ kind: "lt", value: 100 });
  });

  it("lte() and max() are aliases", () => {
    const s1 = schemaOf($.zod.number().lte(50));
    const s2 = schemaOf($.zod.number().max(50));
    expect(s1.checks[0]).toMatchObject({ kind: "lte", value: 50 });
    expect(s2.checks[0]).toMatchObject({ kind: "lte", value: 50 });
  });

  it("positive/nonnegative/negative/nonpositive add sign checks", () => {
    const schema = schemaOf($.zod.number().positive().nonnegative().negative().nonpositive());
    const kinds = schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["positive", "nonnegative", "negative", "nonpositive"]);
  });

  it("multipleOf() and step() are aliases", () => {
    const s1 = schemaOf($.zod.number().multipleOf(3));
    const s2 = schemaOf($.zod.number().step(3));
    expect(s1.checks[0]).toMatchObject({ kind: "multiple_of", value: 3 });
    expect(s2.checks[0]).toMatchObject({ kind: "multiple_of", value: 3 });
  });

  it("int/finite/safe checks produce correct descriptors", () => {
    const schema = schemaOf($.zod.number().int().finite().safe());
    const kinds = schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["int", "finite", "safe"]);
  });

  it("integer variants set variant field", () => {
    for (const v of ["int", "int32", "int64", "uint32", "uint64", "float32", "float64"] as const) {
      const schema = schemaOf($.zod[v]());
      expect(schema.kind).toBe("zod/number");
      expect(schema.variant).toBe(v);
    }
  });

  it("$.zod.nan() produces zod/nan AST node", () => {
    const schema = schemaOf($.zod.nan());
    expect(schema.kind).toBe("zod/nan");
  });

  it("chained number checks accumulate immutably", () => {
    const n1 = $.zod.number();
    const n2 = n1.gt(0);
    const n3 = n2.lt(100);
    expect(n1).not.toBe(n2);
    expect(n2).not.toBe(n3);
    const schema = schemaOf(n3);
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0]).toMatchObject({ kind: "gt", value: 0 });
    expect(schema.checks[1]).toMatchObject({ kind: "lt", value: 100 });
  });

  it("check-level error options work on number checks", () => {
    const schema = schemaOf($.zod.number().gt(0, { error: "Must be positive!" }));
    expect(schema.checks[0].error).toBe("Must be positive!");
  });
});
