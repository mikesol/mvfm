import { describe, expect, it } from "vitest";
import { ZodLiteralBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("literal schemas (#107)", () => {
  it("$.zod.literal() returns a ZodLiteralBuilder", () => {
    expect($.zod.literal("tuna")).toBeInstanceOf(ZodLiteralBuilder);
  });

  it("single string literal produces correct AST", () => {
    const schema = schemaOf($.zod.literal("tuna"));
    expect(schema.kind).toBe("zod/literal");
    expect(schema.value).toBe("tuna");
  });

  it("single number literal produces correct AST", () => {
    const schema = schemaOf($.zod.literal(42));
    expect(schema.kind).toBe("zod/literal");
    expect(schema.value).toBe(42);
  });

  it("single boolean literal produces correct AST", () => {
    const schema = schemaOf($.zod.literal(true));
    expect(schema.kind).toBe("zod/literal");
    expect(schema.value).toBe(true);
  });

  it("multi-value literal produces array in AST", () => {
    const schema = schemaOf($.zod.literal(["red", "green", "blue"]));
    expect(schema.kind).toBe("zod/literal");
    expect(schema.value).toEqual(["red", "green", "blue"]);
  });

  it("literal inherits wrapper methods", () => {
    const schema = schemaOf($.zod.literal("tuna").optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/literal");
    expect(schema.inner.value).toBe("tuna");
  });

  it("literal inherits refinement methods", () => {
    const schema = schemaOf($.zod.literal("tuna").refine((val) => val, { error: "must be tuna" }));
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
  });
});
