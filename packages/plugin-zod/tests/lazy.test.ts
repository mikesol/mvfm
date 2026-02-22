import { describe, expect, it } from "vitest";
import { ZodLazyBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("lazy schemas (#117)", () => {
  it("$.zod.lazy() returns a ZodLazyBuilder", () => {
    expect($.zod.lazy(() => $.zod.string())).toBeInstanceOf(ZodLazyBuilder);
  });

  it("$.zod.lazy() produces zod/lazy AST with lazyId", () => {
    const schema = schemaOf($.zod.lazy(() => $.zod.string()));
    expect(schema.kind).toBe("zod/lazy");
    expect(schema.lazyId).toMatch(/^zod_lazy_/);
    // Note: target is only populated when the lazy resolver runs during parse/safeParse
  });

  it("lazy schema can be called multiple times", () => {
    const getter = () => $.zod.string();
    const lazy1 = $.zod.lazy(getter);
    // We can call lazy() multiple times with the same getter
    $.zod.lazy(getter);
    // Test the schema structure
    const schema = schemaOf(lazy1);
    expect(schema.kind).toBe("zod/lazy");
  });

  it("lazy schema inherits base methods (optional, nullable)", () => {
    const schema = schemaOf($.zod.lazy(() => $.zod.string()).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/lazy");
  });
});
