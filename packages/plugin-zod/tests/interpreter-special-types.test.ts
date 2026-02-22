import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: special types (#157)", () => {
  it("any() accepts any value", async () => {
    expect(await run($.zod.any().parse("hello"))).toBe("hello");
    expect(await run($.zod.any().parse(42))).toBe(42);
    expect(await run($.zod.any().parse(true))).toBe(true);
  });

  it("unknown() accepts any value", async () => {
    expect(await run($.zod.unknown().parse("hello"))).toBe("hello");
    expect(await run($.zod.unknown().parse(42))).toBe(42);
  });

  it("never() rejects all values", async () => {
    const str = (await run($.zod.never().safeParse("hello"))) as any;
    expect(str.success).toBe(false);
    const num = (await run($.zod.never().safeParse(42))) as any;
    expect(num.success).toBe(false);
  });

  it("custom(fn) validates with the predicate (identity)", async () => {
    // Use identity function - truthy values pass
    expect(await run($.zod.custom((val) => val).parse("hello world"))).toBe("hello world");
  });

  it("custom(fn) rejects when predicate returns false", async () => {
    // Use identity - empty string is falsy so fails
    const result = (await run($.zod.custom((val) => val, "Must be truthy").safeParse(""))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Must be truthy");
  });

  it("any() with optional wrapper", async () => {
    const valid = (await run($.zod.any().optional().safeParse("hi"))) as any;
    expect(valid.success).toBe(true);
  });
});
