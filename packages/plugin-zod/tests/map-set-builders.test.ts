import { describe, expect, it } from "vitest";
import { ZodMapBuilder, ZodSetBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("map/set schemas (#116)", () => {
  it("$.zod.map() returns a ZodMapBuilder", () => {
    expect($.zod.map($.zod.string(), $.zod.string())).toBeInstanceOf(ZodMapBuilder);
  });

  it("$.zod.map() produces zod/map AST with key and value schemas", () => {
    const schema = schemaOf($.zod.map($.zod.string(), $.zod.string()));
    expect(schema.kind).toBe("zod/map");
    expect(schema.key.kind).toBe("zod/string");
    expect(schema.value.kind).toBe("zod/string");
  });

  it("$.zod.set() returns a ZodSetBuilder", () => {
    expect($.zod.set($.zod.string())).toBeInstanceOf(ZodSetBuilder);
  });

  it("$.zod.set() produces zod/set AST with value schema", () => {
    const schema = schemaOf($.zod.set($.zod.string()));
    expect(schema.kind).toBe("zod/set");
    expect(schema.value.kind).toBe("zod/string");
  });

  it("set size checks chain correctly", () => {
    const schema = schemaOf($.zod.set($.zod.string()).min(2).max(5));
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0]).toMatchObject({ kind: "min_size", value: 2 });
    expect(schema.checks[1]).toMatchObject({ kind: "max_size", value: 5 });
  });

  it("set size() adds exact size check", () => {
    const schema = schemaOf($.zod.set($.zod.string()).size(3));
    expect(schema.checks[0]).toMatchObject({ kind: "size", value: 3 });
  });

  it("wrappers work on map/set schemas", () => {
    const schema = schemaOf($.zod.set($.zod.string()).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/set");
  });
});
