import { describe, expect, it } from "vitest";
import { ZodEnumBuilder, ZodNativeEnumBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("enum schemas (#108)", () => {
  it("$.zod.enum() returns a ZodEnumBuilder", () => {
    expect($.zod.enum(["Salmon", "Tuna"])).toBeInstanceOf(ZodEnumBuilder);
  });

  it("enum produces correct AST", () => {
    const schema = schemaOf($.zod.enum(["Salmon", "Tuna", "Trout"]));
    expect(schema.kind).toBe("zod/enum");
    expect(schema.values).toEqual(["Salmon", "Tuna", "Trout"]);
  });

  it("enum accepts error config", () => {
    const schema = schemaOf($.zod.enum(["a", "b"], "Invalid!"));
    expect(schema.error).toBe("Invalid!");
  });

  it("extract() produces sub-enum", () => {
    const schema = schemaOf($.zod.enum(["Salmon", "Tuna", "Trout"]).extract(["Salmon", "Trout"]));
    expect(schema.kind).toBe("zod/enum");
    expect(schema.values).toEqual(["Salmon", "Trout"]);
  });

  it("exclude() removes values from enum", () => {
    const schema = schemaOf($.zod.enum(["Salmon", "Tuna", "Trout"]).exclude(["Salmon"]));
    expect(schema.kind).toBe("zod/enum");
    expect(schema.values).toEqual(["Tuna", "Trout"]);
  });

  it("enum supports wrappers", () => {
    const schema = schemaOf($.zod.enum(["a", "b"]).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/enum");
  });

  it("nativeEnum produces correct AST", () => {
    const MyEnum = { Salmon: 0, Tuna: 1, Trout: 2 } as const;
    const schema = schemaOf($.zod.nativeEnum(MyEnum));
    expect(schema.kind).toBe("zod/native_enum");
    expect(schema.entries).toEqual({ Salmon: 0, Tuna: 1, Trout: 2 });
  });

  it("$.zod.nativeEnum() returns a ZodNativeEnumBuilder", () => {
    expect($.zod.nativeEnum({ A: 0 })).toBeInstanceOf(ZodNativeEnumBuilder);
  });

  it("enum inherits refinement methods", () => {
    const schema = schemaOf(
      $.zod.enum(["a", "b"]).refine((val) => val, { error: "must be valid" }),
    );
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
  });
});
