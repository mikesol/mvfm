import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: error customization (#134)", () => {
  it("schema-level error appears in validation output", async () => {
    const result = (await run($.zod.string("Must be a string!").safeParse(42))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be a string!");
  });

  it("schema-level error via object form", async () => {
    const result = (await run($.zod.string({ error: "Bad type!" }).safeParse(42))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Bad type!");
  });

  it("check-level error on min()", async () => {
    const result = (await run(
      $.zod.string().min(5, { error: "Too short!" }).safeParse("hi"),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Too short!");
  });

  it("check-level error on max()", async () => {
    const result = (await run(
      $.zod.string().max(3, { error: "Too long!" }).safeParse("toolong"),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Too long!");
  });

  it("per-parse error appears in validation output", async () => {
    const result = (await run($.zod.string().safeParse(42, { error: "Parse failed!" }))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Parse failed!");
  });

  it("schema-level error takes precedence over parse-level error", async () => {
    const result = (await run(
      $.zod.string("Schema error").safeParse(42, { error: "Parse error" }),
    )) as any;
    expect(result.success).toBe(false);
    // In Zod v4, schema-level error is baked into the schema and takes precedence
    expect(result.error.message).toContain("Schema error");
  });

  it("no error config uses Zod default messages", async () => {
    const result = (await run($.zod.string().safeParse(42))) as any;
    expect(result.success).toBe(false);
    // Default Zod message, not custom
    expect(result.error.message).not.toContain("Must be");
    expect(result.error.message).toContain("invalid_type");
  });
});
