import { describe, expect, it } from "vitest";
import { ZodArrayBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("array schemas (#110)", () => {
  it("$.zod.array() returns a ZodArrayBuilder", () => {
    const builder = $.zod.array($.zod.string());
    expect(builder).toBeInstanceOf(ZodArrayBuilder);
  });

  it("$.zod.array() produces zod/array AST with element schema", () => {
    const schema = schemaOf($.zod.array($.zod.string()));
    expect(schema.kind).toBe("zod/array");
    expect(schema.element).toBeDefined();
    expect(schema.element.kind).toBe("zod/string");
  });

  it("$.zod.array() accepts error param", () => {
    const schema = schemaOf($.zod.array($.zod.string(), "Not an array!"));
    expect(schema.error).toBe("Not an array!");
  });

  it("min() adds min_length check", () => {
    const schema = schemaOf($.zod.array($.zod.string()).min(3));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0]).toMatchObject({ kind: "min_length", value: 3 });
  });

  it("max() adds max_length check", () => {
    const schema = schemaOf($.zod.array($.zod.string()).max(10));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0]).toMatchObject({ kind: "max_length", value: 10 });
  });

  it("length() adds length check", () => {
    const schema = schemaOf($.zod.array($.zod.string()).length(5));
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0]).toMatchObject({ kind: "length", value: 5 });
  });

  it("chained min + max checks", () => {
    const schema = schemaOf($.zod.array($.zod.string()).min(2).max(5));
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0]).toMatchObject({ kind: "min_length", value: 2 });
    expect(schema.checks[1]).toMatchObject({ kind: "max_length", value: 5 });
  });

  it("check accepts error option", () => {
    const schema = schemaOf($.zod.array($.zod.string()).min(1, { error: "Need at least one!" }));
    expect(schema.checks[0].error).toBe("Need at least one!");
  });

  it("nested arrays produce correct AST", () => {
    const schema = schemaOf($.zod.array($.zod.array($.zod.string())));
    expect(schema.kind).toBe("zod/array");
    expect(schema.element.kind).toBe("zod/array");
    expect(schema.element.element.kind).toBe("zod/string");
  });

  it("immutable chaining — min() returns new instance", () => {
    const a1 = $.zod.array($.zod.string());
    const a2 = a1.min(3);
    expect(a1).not.toBe(a2);
  });

  it("wrappers work on array schemas", () => {
    const schema = schemaOf($.zod.array($.zod.string()).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/array");
    expect(schema.inner.element.kind).toBe("zod/string");
  });
});
