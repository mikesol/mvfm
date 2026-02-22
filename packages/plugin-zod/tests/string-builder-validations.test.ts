import { describe, expect, it } from "vitest";
import { $, schemaOf } from "./test-helpers";

describe("zod string: full validations (#100)", () => {
  it("length() produces length check", () => {
    const schema = schemaOf($.zod.string().length(5));
    expect(schema.checks[0]).toEqual({ kind: "length", value: 5 });
  });

  it("regex() produces regex check with pattern and flags", () => {
    const schema = schemaOf($.zod.string().regex(/^[a-z]+$/i));
    expect(schema.checks[0]).toEqual({
      kind: "regex",
      pattern: "^[a-z]+$",
      flags: "i",
    });
  });

  it("startsWith() produces starts_with check", () => {
    const schema = schemaOf($.zod.string().startsWith("hello"));
    expect(schema.checks[0]).toEqual({ kind: "starts_with", value: "hello" });
  });

  it("endsWith() produces ends_with check", () => {
    const schema = schemaOf($.zod.string().endsWith("!"));
    expect(schema.checks[0]).toEqual({ kind: "ends_with", value: "!" });
  });

  it("includes() produces includes check", () => {
    const schema = schemaOf($.zod.string().includes("@"));
    expect(schema.checks[0]).toEqual({ kind: "includes", value: "@" });
  });

  it("uppercase() produces uppercase check", () => {
    const schema = schemaOf($.zod.string().uppercase());
    expect(schema.checks[0]).toEqual({ kind: "uppercase" });
  });

  it("lowercase() produces lowercase check", () => {
    const schema = schemaOf($.zod.string().lowercase());
    expect(schema.checks[0]).toEqual({ kind: "lowercase" });
  });

  it("trim() produces trim check", () => {
    const schema = schemaOf($.zod.string().trim());
    expect(schema.checks[0]).toEqual({ kind: "trim" });
  });

  it("toLowerCase() produces to_lower_case check", () => {
    const schema = schemaOf($.zod.string().toLowerCase());
    expect(schema.checks[0]).toEqual({ kind: "to_lower_case" });
  });

  it("toUpperCase() produces to_upper_case check", () => {
    const schema = schemaOf($.zod.string().toUpperCase());
    expect(schema.checks[0]).toEqual({ kind: "to_upper_case" });
  });

  it("normalize() produces normalize check with default NFC", () => {
    const schema = schemaOf($.zod.string().normalize());
    expect(schema.checks[0]).toEqual({ kind: "normalize", form: "NFC" });
  });

  it("normalize(form) passes custom form", () => {
    const schema = schemaOf($.zod.string().normalize("NFKD"));
    expect(schema.checks[0]).toEqual({ kind: "normalize", form: "NFKD" });
  });

  it("chaining multiple checks accumulates in order", () => {
    const schema = schemaOf($.zod.string().min(1).max(100).startsWith("a").endsWith("z"));
    const kinds = schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["min_length", "max_length", "starts_with", "ends_with"]);
  });

  it("error option flows through to check descriptor", () => {
    const schema = schemaOf($.zod.string().startsWith("x", { error: "Must start with x" }));
    expect(schema.checks[0].error).toBe("Must start with x");
  });
});
