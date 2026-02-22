import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: parse operations (#133)", () => {
  it("parse() validates valid string input", async () => {
    expect(await run($.zod.string().parse("hello"))).toBe("hello");
  });

  it("parse() throws on invalid input", async () => {
    await expect(run($.zod.string().parse(42))).rejects.toThrow();
  });

  it("safeParse() returns success for valid input", async () => {
    const result = (await run($.zod.string().safeParse("hello"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it("safeParse() returns failure for invalid input", async () => {
    const result = (await run($.zod.string().safeParse(123))) as any;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("parseAsync() validates valid input", async () => {
    expect(await run($.zod.string().parseAsync("async-hello"))).toBe("async-hello");
  });

  it("parseAsync() throws on invalid input", async () => {
    await expect(run($.zod.string().parseAsync(false))).rejects.toThrow();
  });

  it("safeParseAsync() returns success for valid input", async () => {
    const result = (await run($.zod.string().safeParseAsync("ok"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("ok");
  });

  it("safeParseAsync() returns failure for invalid input", async () => {
    const result = (await run($.zod.string().safeParseAsync(42))) as any;
    expect(result.success).toBe(false);
  });

  it("string checks: min_length rejects short strings", async () => {
    const result = (await run($.zod.string().min(5).safeParse("hi"))) as any;
    expect(result.success).toBe(false);
  });

  it("string checks: min_length accepts valid strings", async () => {
    const result = (await run($.zod.string().min(5).safeParse("hello world"))) as any;
    expect(result.success).toBe(true);
  });

  it("string checks: max_length rejects long strings", async () => {
    const result = (await run($.zod.string().max(3).safeParse("toolong"))) as any;
    expect(result.success).toBe(false);
  });

  it("chained min + max checks work together", async () => {
    const schema = $.zod.string().min(2).max(5);
    const tooShort = (await run(schema.safeParse("a"))) as any;
    const justRight = (await run(schema.safeParse("abc"))) as any;
    const tooLong = (await run(schema.safeParse("abcdefg"))) as any;
    expect(tooShort.success).toBe(false);
    expect(justRight.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });
});
