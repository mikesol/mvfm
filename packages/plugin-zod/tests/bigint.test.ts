import { describe, expect, it } from "vitest";
import { ZodBigIntBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("bigint schema (#103)", () => {
  it("$.zod.bigint() returns a ZodBigIntBuilder", () => {
    expect($.zod.bigint()).toBeInstanceOf(ZodBigIntBuilder);
  });

  it("$.zod.bigint() produces zod/bigint AST node", () => {
    const schema = schemaOf($.zod.bigint());
    expect(schema.kind).toBe("zod/bigint");
    expect(schema.checks).toEqual([]);
  });

  it("$.zod.bigint() accepts error param", () => {
    const schema = schemaOf($.zod.bigint("Not a bigint!"));
    expect(schema.error).toBe("Not a bigint!");
  });

  it("gt() serializes bigint value as string", () => {
    const schema = schemaOf($.zod.bigint().gt(5n));
    expect(schema.checks[0]).toMatchObject({ kind: "gt", value: "5" });
  });

  it("gte() and min() are aliases", () => {
    const s1 = schemaOf($.zod.bigint().gte(10n));
    const s2 = schemaOf($.zod.bigint().min(10n));
    expect(s1.checks[0]).toMatchObject({ kind: "gte", value: "10" });
    expect(s2.checks[0]).toMatchObject({ kind: "gte", value: "10" });
  });

  it("lte() and max() are aliases", () => {
    const s1 = schemaOf($.zod.bigint().lte(50n));
    const s2 = schemaOf($.zod.bigint().max(50n));
    expect(s1.checks[0]).toMatchObject({ kind: "lte", value: "50" });
    expect(s2.checks[0]).toMatchObject({ kind: "lte", value: "50" });
  });

  it("sign checks produce correct descriptors", () => {
    const schema = schemaOf($.zod.bigint().positive().nonnegative().negative().nonpositive());
    const kinds = schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["positive", "nonnegative", "negative", "nonpositive"]);
  });

  it("multipleOf() and step() are aliases", () => {
    const s1 = schemaOf($.zod.bigint().multipleOf(3n));
    const s2 = schemaOf($.zod.bigint().step(3n));
    expect(s1.checks[0]).toMatchObject({ kind: "multiple_of", value: "3" });
    expect(s2.checks[0]).toMatchObject({ kind: "multiple_of", value: "3" });
  });

  it("chained checks accumulate immutably", () => {
    const b1 = $.zod.bigint();
    const b2 = b1.gt(0n);
    const b3 = b2.lt(100n);
    expect(b1).not.toBe(b2);
    expect(b2).not.toBe(b3);
    const schema = schemaOf(b3);
    expect(schema.checks).toHaveLength(2);
  });
});
