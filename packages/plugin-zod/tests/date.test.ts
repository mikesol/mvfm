import { describe, expect, it } from "vitest";
import { ZodDateBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("date schema (#105)", () => {
  it("$.zod.date() produces zod/date AST node", () => {
    const schema = schemaOf($.zod.date());
    expect(schema.kind).toBe("zod/date");
    expect(schema.checks).toEqual([]);
  });

  it("$.zod.date() returns ZodDateBuilder", () => {
    expect($.zod.date()).toBeInstanceOf(ZodDateBuilder);
  });

  it("$.zod.date() accepts error param", () => {
    const schema = schemaOf($.zod.date("Not a date!"));
    expect(schema.error).toBe("Not a date!");
  });

  it("min() produces min check with ISO date string", () => {
    const minDate = new Date("2000-01-01T00:00:00.000Z");
    const schema = schemaOf($.zod.date().min(minDate));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0].kind).toBe("min");
    expect(schema.checks[0].value).toBe("2000-01-01T00:00:00.000Z");
  });

  it("max() produces max check with ISO date string", () => {
    const maxDate = new Date("2030-12-31T23:59:59.999Z");
    const schema = schemaOf($.zod.date().max(maxDate));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0].kind).toBe("max");
    expect(schema.checks[0].value).toBe("2030-12-31T23:59:59.999Z");
  });

  it("min/max chain immutably", () => {
    const d1 = $.zod.date();
    const d2 = d1.min(new Date("2000-01-01"));
    const d3 = d2.max(new Date("2030-12-31"));
    expect(d1).not.toBe(d2);
    expect(d2).not.toBe(d3);
    const schema = schemaOf(d3);
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("min");
    expect(schema.checks[1].kind).toBe("max");
  });

  it("check-level error options work on date checks", () => {
    const schema = schemaOf($.zod.date().min(new Date("2000-01-01"), { error: "Too early" }));
    expect(schema.checks[0].error).toBe("Too early");
  });

  it("date supports wrappers", () => {
    const schema = schemaOf($.zod.date().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/date");
  });
});
