import { describe, expect, it } from "vitest";
import { ZodStringboolBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("stringbool schemas (#156)", () => {
  it("$.zod.stringbool() returns a ZodStringboolBuilder", () => {
    expect($.zod.stringbool()).toBeInstanceOf(ZodStringboolBuilder);
  });

  it("produces correct AST with defaults", () => {
    const schema = schemaOf($.zod.stringbool());
    expect(schema.kind).toBe("zod/stringbool");
  });

  it("produces correct AST with custom truthy/falsy", () => {
    const schema = schemaOf($.zod.stringbool({ truthy: ["yep"], falsy: ["nah"] }));
    expect(schema.kind).toBe("zod/stringbool");
    expect(schema.truthy).toEqual(["yep"]);
    expect(schema.falsy).toEqual(["nah"]);
  });

  it("produces correct AST with coerce option", () => {
    const schema = schemaOf($.zod.stringbool({ coerce: false }));
    expect(schema.kind).toBe("zod/stringbool");
    expect(schema.coerce).toBe(false);
  });

  it("inherits wrapper methods", () => {
    const schema = schemaOf($.zod.stringbool().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/stringbool");
  });
});
