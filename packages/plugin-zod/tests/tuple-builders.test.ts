import { describe, expect, it } from "vitest";
import { ZodTupleBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("tuple schemas (#111)", () => {
  it("$.zod.tuple() returns a ZodTupleBuilder", () => {
    expect($.zod.tuple([$.zod.string()])).toBeInstanceOf(ZodTupleBuilder);
  });

  it("$.zod.tuple() produces zod/tuple AST with items", () => {
    const schema = schemaOf($.zod.tuple([$.zod.string(), $.zod.string()]));
    expect(schema.kind).toBe("zod/tuple");
    expect(schema.items).toHaveLength(2);
    expect(schema.items[0].kind).toBe("zod/string");
    expect(schema.items[1].kind).toBe("zod/string");
  });

  it("$.zod.tuple() with rest element", () => {
    const schema = schemaOf($.zod.tuple([$.zod.string()], $.zod.string()));
    expect(schema.kind).toBe("zod/tuple");
    expect(schema.items).toHaveLength(1);
    expect(schema.rest).toBeDefined();
    expect(schema.rest.kind).toBe("zod/string");
  });

  it("$.zod.tuple() without rest omits rest field", () => {
    const schema = schemaOf($.zod.tuple([$.zod.string()]));
    expect(schema.rest).toBeUndefined();
  });

  it("$.zod.tuple() accepts error param", () => {
    const schema = schemaOf($.zod.tuple([$.zod.string()], undefined, "Must be tuple!"));
    expect(schema.error).toBe("Must be tuple!");
  });

  it("wrappers work on tuple schemas", () => {
    const schema = schemaOf($.zod.tuple([$.zod.string()]).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/tuple");
  });
});
