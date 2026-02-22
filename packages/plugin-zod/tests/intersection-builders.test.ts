import { describe, expect, it } from "vitest";
import { ZodIntersectionBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("intersection schemas (#114)", () => {
  it("$.zod.intersection() returns a ZodIntersectionBuilder", () => {
    expect($.zod.intersection($.zod.string(), $.zod.string())).toBeInstanceOf(
      ZodIntersectionBuilder,
    );
  });

  it("$.zod.intersection() produces zod/intersection AST with left and right", () => {
    const schema = schemaOf($.zod.intersection($.zod.string(), $.zod.string().min(3)));
    expect(schema.kind).toBe("zod/intersection");
    expect(schema.left).toBeDefined();
    expect(schema.left.kind).toBe("zod/string");
    expect(schema.right).toBeDefined();
    expect(schema.right.kind).toBe("zod/string");
    expect(schema.right.checks).toHaveLength(1);
  });

  it("$.zod.intersection() accepts error param", () => {
    const schema = schemaOf(
      $.zod.intersection($.zod.string(), $.zod.string(), "Intersection fail!"),
    );
    expect(schema.error).toBe("Intersection fail!");
  });

  it("wrappers work on intersection schemas", () => {
    const schema = schemaOf($.zod.intersection($.zod.string(), $.zod.string()).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/intersection");
  });
});
