import { describe, expect, it } from "vitest";
import { $, schemaOf } from "./test-helpers";

describe("coercion constructors (#106)", () => {
  it("$.zod.coerce.string() produces zod/string node with coerce flag", () => {
    const schema = schemaOf($.zod.coerce.string());
    expect(schema.kind).toBe("zod/string");
    expect(schema.coerce).toBe(true);
  });

  it("coerced string still supports checks", () => {
    const schema = schemaOf($.zod.coerce.string().min(3).max(10));
    expect(schema.coerce).toBe(true);
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("min_length");
    expect(schema.checks[1].kind).toBe("max_length");
  });

  it("coerced string supports wrappers", () => {
    const schema = schemaOf($.zod.coerce.string().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.inner.coerce).toBe(true);
  });

  it("coerced string accepts error config", () => {
    const schema = schemaOf($.zod.coerce.string("Must be coercible"));
    expect(schema.coerce).toBe(true);
    expect(schema.error).toBe("Must be coercible");
  });

  it("non-coerced string does not have coerce flag", () => {
    const schema = schemaOf($.zod.string());
    expect(schema.coerce).toBeUndefined();
  });

  it("$.zod.coerce.number() produces zod/number node with coerce flag", () => {
    const schema = schemaOf($.zod.coerce.number());
    expect(schema.kind).toBe("zod/number");
    expect(schema.coerce).toBe(true);
  });

  it("coerced number still supports checks", () => {
    const schema = schemaOf($.zod.coerce.number().gt(0).lt(100));
    expect(schema.coerce).toBe(true);
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("gt");
    expect(schema.checks[1].kind).toBe("lt");
  });

  it("coerced number accepts error config", () => {
    const schema = schemaOf($.zod.coerce.number("Must be coercible"));
    expect(schema.coerce).toBe(true);
    expect(schema.error).toBe("Must be coercible");
  });

  it("non-coerced number does not have coerce flag", () => {
    const schema = schemaOf($.zod.number());
    expect(schema.coerce).toBeUndefined();
  });
});
