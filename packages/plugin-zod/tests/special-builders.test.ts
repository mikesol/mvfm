import { isCExpr } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodSimpleBuilder, ZodWrappedBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("special types (#120)", () => {
  it("$.zod.any() produces zod/any AST node", () => {
    expect(schemaOf($.zod.any()).kind).toBe("zod/any");
  });

  it("$.zod.any() returns ZodSimpleBuilder", () => {
    expect($.zod.any()).toBeInstanceOf(ZodSimpleBuilder);
  });

  it("$.zod.unknown() produces zod/unknown AST node", () => {
    expect(schemaOf($.zod.unknown()).kind).toBe("zod/unknown");
  });

  it("$.zod.never() produces zod/never AST node", () => {
    expect(schemaOf($.zod.never()).kind).toBe("zod/never");
  });

  it("$.zod.nan() produces zod/nan AST node", () => {
    expect(schemaOf($.zod.nan()).kind).toBe("zod/nan");
  });

  it("$.zod.promise(inner) produces zod/promise wrapper node", () => {
    const schema = schemaOf($.zod.promise($.zod.string()));
    expect(schema.kind).toBe("zod/promise");
    expect(schema.inner.kind).toBe("zod/string");
  });

  it("$.zod.promise() returns ZodWrappedBuilder", () => {
    expect($.zod.promise($.zod.string())).toBeInstanceOf(ZodWrappedBuilder);
  });

  it("$.zod.custom(fn) produces zod/custom AST node with predicate", () => {
    const schema = schemaOf($.zod.custom((val) => val));
    expect(schema.kind).toBe("zod/custom");
    // In the new system, predicate is a { param, body } lambda descriptor with CExpr values
    expect(schema.predicate).toBeDefined();
    expect(isCExpr(schema.predicate.param)).toBe(true);
    expect(isCExpr(schema.predicate.body)).toBe(true);
  });

  it("$.zod.custom(fn) accepts error config", () => {
    const schema = schemaOf($.zod.custom((val) => val, "Must pass!"));
    expect(schema.kind).toBe("zod/custom");
    expect(schema.error).toBe("Must pass!");
  });

  it("special types support wrappers", () => {
    const schema = schemaOf($.zod.any().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/any");
  });
});
