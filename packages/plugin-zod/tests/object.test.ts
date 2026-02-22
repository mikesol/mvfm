import { describe, expect, it } from "vitest";
import { ZodObjectBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("object schemas (#109)", () => {
  it("$.zod.object() returns ZodObjectBuilder", () => {
    expect($.zod.object({ name: $.zod.string() })).toBeInstanceOf(ZodObjectBuilder);
  });

  it("object produces correct AST with shape", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string(), age: $.zod.string().min(1) }));
    expect(schema.kind).toBe("zod/object");
    expect(schema.mode).toBe("strip");
    expect(schema.shape.name.kind).toBe("zod/string");
    expect(schema.shape.age.kind).toBe("zod/string");
    expect(schema.shape.age.checks).toHaveLength(1);
  });

  it("object accepts error param", () => {
    const schema = schemaOf($.zod.object({ x: $.zod.string() }, "Bad object!"));
    expect(schema.error).toBe("Bad object!");
  });

  it("strictObject sets mode to strict", () => {
    const schema = schemaOf($.zod.strictObject({ name: $.zod.string() }));
    expect(schema.mode).toBe("strict");
  });

  it("looseObject sets mode to loose", () => {
    const schema = schemaOf($.zod.looseObject({ name: $.zod.string() }));
    expect(schema.mode).toBe("loose");
  });

  it("pick() selects specific fields", () => {
    const schema = schemaOf(
      $.zod.object({ name: $.zod.string(), age: $.zod.string() }).pick({ name: true }),
    );
    expect(Object.keys(schema.shape)).toEqual(["name"]);
  });

  it("omit() removes specific fields", () => {
    const schema = schemaOf(
      $.zod.object({ name: $.zod.string(), age: $.zod.string() }).omit({ age: true }),
    );
    expect(Object.keys(schema.shape)).toEqual(["name"]);
  });

  it("partial() wraps all fields with optional", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string() }).partial());
    expect(schema.shape.name.kind).toBe("zod/optional");
    expect(schema.shape.name.inner.kind).toBe("zod/string");
  });

  it("partial() with mask wraps only specified fields", () => {
    const schema = schemaOf(
      $.zod.object({ name: $.zod.string(), age: $.zod.string() }).partial({ name: true }),
    );
    expect(schema.shape.name.kind).toBe("zod/optional");
    expect(schema.shape.age.kind).toBe("zod/string");
  });

  it("required() unwraps optional fields", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string() }).partial().required());
    expect(schema.shape.name.kind).toBe("zod/string");
  });

  it("required() with mask unwraps only specified fields", () => {
    const schema = schemaOf(
      $.zod
        .object({ name: $.zod.string(), age: $.zod.string() })
        .partial()
        .required({ name: true }),
    );
    expect(schema.shape.name.kind).toBe("zod/string");
    expect(schema.shape.age.kind).toBe("zod/optional");
  });

  it("extend() adds fields to shape", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string() }).extend({ age: $.zod.string() }));
    expect(Object.keys(schema.shape)).toEqual(["name", "age"]);
  });

  it("catchall() sets catchall schema in AST", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string() }).catchall($.zod.string()));
    expect(schema.catchall).toBeDefined();
    expect(schema.catchall.kind).toBe("zod/string");
  });

  it("object supports wrappers", () => {
    const schema = schemaOf($.zod.object({ name: $.zod.string() }).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/object");
  });

  it("immutable chaining: operations do not mutate original", () => {
    const base = $.zod.object({ name: $.zod.string() });
    const extended = base.extend({ age: $.zod.string() });
    expect(base).not.toBe(extended);
  });
});
