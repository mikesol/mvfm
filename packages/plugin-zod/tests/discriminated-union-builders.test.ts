import { describe, expect, it } from "vitest";
import { ZodDiscriminatedUnionBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("discriminatedUnion schemas (#113)", () => {
  it("$.zod.discriminatedUnion() returns a ZodDiscriminatedUnionBuilder", () => {
    const builder = $.zod.discriminatedUnion("status", [
      $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
      $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
    ]);
    expect(builder).toBeInstanceOf(ZodDiscriminatedUnionBuilder);
  });

  it("$.zod.discriminatedUnion() produces zod/discriminated_union AST with discriminator and options", () => {
    const schema = schemaOf(
      $.zod.discriminatedUnion("status", [
        $.zod.object({ status: $.zod.literal("success"), data: $.zod.string() }),
        $.zod.object({ status: $.zod.literal("failed"), error: $.zod.string() }),
      ]),
    );
    expect(schema.kind).toBe("zod/discriminated_union");
    expect(schema.discriminator).toBe("status");
    expect(schema.options).toHaveLength(2);
    expect(schema.options[0].kind).toBe("zod/object");
    expect(schema.options[1].kind).toBe("zod/object");
  });

  it("$.zod.discriminatedUnion() accepts error param", () => {
    const schema = schemaOf(
      $.zod.discriminatedUnion(
        "type",
        [$.zod.object({ type: $.zod.literal("a") }), $.zod.object({ type: $.zod.literal("b") })],
        "Bad discriminated union!",
      ),
    );
    expect(schema.error).toBe("Bad discriminated union!");
  });

  it("wrappers work on discriminated union schemas", () => {
    const schema = schemaOf(
      $.zod
        .discriminatedUnion("kind", [
          $.zod.object({ kind: $.zod.literal("circle") }),
          $.zod.object({ kind: $.zod.literal("square") }),
        ])
        .optional(),
    );
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/discriminated_union");
    expect(schema.inner.discriminator).toBe("kind");
  });

  it("nested discriminated unions are supported", () => {
    const inner = $.zod.discriminatedUnion("shape", [
      $.zod.object({ shape: $.zod.literal("circle"), radius: $.zod.number() }),
      $.zod.object({ shape: $.zod.literal("square"), side: $.zod.number() }),
    ]);
    const schema = schemaOf(
      $.zod.discriminatedUnion("type", [
        $.zod.object({ type: $.zod.literal("geometry"), data: inner }),
        $.zod.object({ type: $.zod.literal("text"), content: $.zod.string() }),
      ]),
    );
    expect(schema.kind).toBe("zod/discriminated_union");
    expect(schema.discriminator).toBe("type");
    // Check that one of the options contains a nested discriminated union
    const geometryOption = schema.options[0];
    const dataField = geometryOption.shape.data;
    expect(dataField.kind).toBe("zod/discriminated_union");
    expect(dataField.discriminator).toBe("shape");
  });
});
