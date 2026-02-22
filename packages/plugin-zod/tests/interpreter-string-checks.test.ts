import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: string checks (#100 + #137)", () => {
  it("length() rejects wrong length", async () => {
    const short = (await run($.zod.string().length(5).safeParse("hi"))) as any;
    const exact = (await run($.zod.string().length(5).safeParse("hello"))) as any;
    const long = (await run($.zod.string().length(5).safeParse("toolong"))) as any;
    expect(short.success).toBe(false);
    expect(exact.success).toBe(true);
    expect(long.success).toBe(false);
  });

  it("regex() validates pattern", async () => {
    const valid = (await run(
      $.zod
        .string()
        .regex(/^[a-z]+$/)
        .safeParse("hello"),
    )) as any;
    const invalid = (await run(
      $.zod
        .string()
        .regex(/^[a-z]+$/)
        .safeParse("Hello123"),
    )) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("regex() respects flags", async () => {
    const upper = (await run(
      $.zod
        .string()
        .regex(/^hello$/i)
        .safeParse("HELLO"),
    )) as any;
    expect(upper.success).toBe(true);
  });

  it("startsWith() validates prefix", async () => {
    const valid = (await run($.zod.string().startsWith("hello").safeParse("hello world"))) as any;
    const invalid = (await run($.zod.string().startsWith("hello").safeParse("goodbye"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("endsWith() validates suffix", async () => {
    const valid = (await run($.zod.string().endsWith("!").safeParse("hello!"))) as any;
    const invalid = (await run($.zod.string().endsWith("!").safeParse("hello"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("includes() validates substring", async () => {
    const valid = (await run($.zod.string().includes("@").safeParse("user@example.com"))) as any;
    const invalid = (await run($.zod.string().includes("@").safeParse("no-at"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("uppercase() rejects lowercase", async () => {
    const valid = (await run($.zod.string().uppercase().safeParse("HELLO"))) as any;
    const invalid = (await run($.zod.string().uppercase().safeParse("Hello"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("lowercase() rejects uppercase", async () => {
    const valid = (await run($.zod.string().lowercase().safeParse("hello"))) as any;
    const invalid = (await run($.zod.string().lowercase().safeParse("Hello"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("trim() strips whitespace", async () => {
    expect(await run($.zod.string().trim().parse("  hello  "))).toBe("hello");
  });

  it("toLowerCase() transforms to lowercase", async () => {
    expect(await run($.zod.string().toLowerCase().parse("HELLO"))).toBe("hello");
  });

  it("toUpperCase() transforms to uppercase", async () => {
    expect(await run($.zod.string().toUpperCase().parse("hello"))).toBe("HELLO");
  });

  it("chained checks: min + startsWith + endsWith", async () => {
    const schema = $.zod.string().min(5).startsWith("h").endsWith("!");
    const tooShort = (await run(schema.safeParse("h!"))) as any;
    const wrongStart = (await run(schema.safeParse("world!"))) as any;
    const valid = (await run(schema.safeParse("hello!"))) as any;
    expect(tooShort.success).toBe(false);
    expect(wrongStart.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("check-level error on startsWith", async () => {
    const result = (await run(
      $.zod.string().startsWith("x", { error: "Must start with x" }).safeParse("hello"),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must start with x");
  });

  it("transforms + validations chain correctly", async () => {
    // trim first, then check min length
    const trimmedTooShort = (await run($.zod.string().trim().min(5).safeParse("   hi   "))) as any;
    const trimmedValid = (await run($.zod.string().trim().min(5).safeParse("  hello  "))) as any;
    expect(trimmedTooShort.success).toBe(false);
    expect(trimmedValid.success).toBe(true);
  });
});
