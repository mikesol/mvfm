import { describe, expect, it } from "vitest";
import { ZodWrappedBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("wrapper methods (#99)", () => {
  it("optional() produces zod/optional wrapper node", () => {
    const schema = schemaOf($.zod.string().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/string");
  });

  it("nullable() produces zod/nullable wrapper node", () => {
    const schema = schemaOf($.zod.string().nullable());
    expect(schema.kind).toBe("zod/nullable");
    expect(schema.inner.kind).toBe("zod/string");
  });

  it("nullish() produces zod/nullish wrapper node", () => {
    const schema = schemaOf($.zod.string().nullish());
    expect(schema.kind).toBe("zod/nullish");
    expect(schema.inner.kind).toBe("zod/string");
  });

  it("nonoptional() produces zod/nonoptional wrapper node", () => {
    const schema = schemaOf($.zod.string().nonoptional());
    expect(schema.kind).toBe("zod/nonoptional");
  });

  it("default() produces zod/default wrapper with value", () => {
    const schema = schemaOf($.zod.string().default("hello"));
    expect(schema.kind).toBe("zod/default");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.value).toBeDefined();
  });

  it("catch() produces zod/catch wrapper with value", () => {
    const schema = schemaOf($.zod.string().catch("fallback"));
    expect(schema.kind).toBe("zod/catch");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.value).toBeDefined();
  });

  it("readonly() produces zod/readonly wrapper node", () => {
    const schema = schemaOf($.zod.string().readonly());
    expect(schema.kind).toBe("zod/readonly");
    expect(schema.inner.kind).toBe("zod/string");
  });

  it("brand() produces zod/branded wrapper node", () => {
    const schema = schemaOf($.zod.string().brand("Email"));
    expect(schema.kind).toBe("zod/branded");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.brand).toBe("Email");
  });

  it("wrappers compose: optional().nullable() nests correctly", () => {
    const schema = schemaOf($.zod.string().min(3).optional().nullable());
    expect(schema.kind).toBe("zod/nullable");
    expect(schema.inner.kind).toBe("zod/optional");
    expect(schema.inner.inner.kind).toBe("zod/string");
    expect(schema.inner.inner.checks).toHaveLength(1);
    expect(schema.inner.inner.checks[0].kind).toBe("min_length");
  });

  it("optional() returns ZodWrappedBuilder", () => {
    expect($.zod.string().optional()).toBeInstanceOf(ZodWrappedBuilder);
  });

  it("prefault() produces zod/prefault wrapper with value", () => {
    const schema = schemaOf($.zod.string().prefault("pre"));
    expect(schema.kind).toBe("zod/prefault");
    expect(schema.inner.kind).toBe("zod/string");
  });
});
