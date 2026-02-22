import { describe, expect, it } from "vitest";
import { ZodPrimitiveBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("primitive types (#104)", () => {
  it("$.zod.boolean() produces zod/boolean AST node", () => {
    expect(schemaOf($.zod.boolean()).kind).toBe("zod/boolean");
  });

  it("$.zod.boolean() returns ZodPrimitiveBuilder", () => {
    expect($.zod.boolean()).toBeInstanceOf(ZodPrimitiveBuilder);
  });

  it("$.zod.boolean() accepts error param", () => {
    expect(schemaOf($.zod.boolean("Not boolean!")).error).toBe("Not boolean!");
  });

  it("$.zod.null() produces zod/null AST node", () => {
    expect(schemaOf($.zod.null()).kind).toBe("zod/null");
  });

  it("$.zod.undefined() produces zod/undefined AST node", () => {
    expect(schemaOf($.zod.undefined()).kind).toBe("zod/undefined");
  });

  it("$.zod.void() produces zod/void AST node", () => {
    expect(schemaOf($.zod.void()).kind).toBe("zod/void");
  });

  it("$.zod.symbol() produces zod/symbol AST node", () => {
    expect(schemaOf($.zod.symbol()).kind).toBe("zod/symbol");
  });

  it("primitives support wrappers", () => {
    const schema = schemaOf($.zod.boolean().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/boolean");
  });
});
