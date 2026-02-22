import { describe, expect, it } from "vitest";
import { $, schemaOf } from "./test-helpers";

describe("ZodSchemaBuilder base class", () => {
  it("_addCheck creates immutable chain", () => {
    const s1 = $.zod.string();
    const s2 = s1.min(5);
    const s3 = s2.max(10);

    // Each is a different instance (immutable chaining)
    expect(s1).not.toBe(s2);
    expect(s2).not.toBe(s3);

    // s3 should have 2 checks
    const schema = schemaOf(s3);
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("min_length");
    expect(schema.checks[0].value).toBe(5);
    expect(schema.checks[1].kind).toBe("max_length");
    expect(schema.checks[1].value).toBe(10);
  });

  it("checks accept error/abort/when options", () => {
    const builder = $.zod.string().min(5, { error: "Too short!", abort: true });
    const schema = schemaOf(builder);
    const check = schema.checks[0];
    expect(check.error).toBe("Too short!");
    expect(check.abort).toBe(true);
  });

  it("parse() produces CExpr with zod/parse kind", () => {
    const expr = $.zod.string().parse("hello");
    expect(expr.__kind).toBe("zod/parse");
  });

  it("safeParse() produces CExpr with zod/safe_parse kind", () => {
    const expr = $.zod.string().safeParse("hello");
    expect(expr.__kind).toBe("zod/safe_parse");
  });

  it("chained checks appear in schema node", () => {
    const builder = $.zod.string().min(3).max(100);
    const schema = schemaOf(builder);
    expect(schema.kind).toBe("zod/string");
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0]).toMatchObject({ kind: "min_length", value: 3 });
    expect(schema.checks[1]).toMatchObject({ kind: "max_length", value: 100 });
  });

  it("parseAsync() produces CExpr with zod/parse_async kind", () => {
    const expr = $.zod.string().parseAsync("hello");
    expect(expr.__kind).toBe("zod/parse_async");
  });

  it("safeParseAsync() produces CExpr with zod/safe_parse_async kind", () => {
    const expr = $.zod.string().safeParseAsync("hello");
    expect(expr.__kind).toBe("zod/safe_parse_async");
  });

  it("parse() accepts per-parse error config", () => {
    const expr = $.zod.string().parse("hello", { error: "Parse failed!" });
    // The error is serialized into the CExpr args
    expect(expr.__kind).toBe("zod/parse");
  });

  it("safeParse() accepts per-parse error config", () => {
    const expr = $.zod.string().safeParse("hello", { error: "Validation error" });
    expect(expr.__kind).toBe("zod/safe_parse");
  });

  it("parse() without error option works", () => {
    const expr = $.zod.string().parse("hello");
    expect(expr.__kind).toBe("zod/parse");
  });
});
