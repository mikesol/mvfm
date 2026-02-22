import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: literal schemas (#144)", () => {
  it("parse() accepts matching string literal", async () => {
    expect(await run($.zod.literal("tuna").parse("tuna"))).toBe("tuna");
  });

  it("parse() rejects non-matching string literal", async () => {
    await expect(run($.zod.literal("tuna").parse("salmon"))).rejects.toThrow();
  });

  it("parse() accepts matching number literal", async () => {
    expect(await run($.zod.literal(42).parse(42))).toBe(42);
  });

  it("parse() rejects non-matching number literal", async () => {
    await expect(run($.zod.literal(42).parse(99))).rejects.toThrow();
  });

  it("parse() accepts matching boolean literal", async () => {
    expect(await run($.zod.literal(true).parse(true))).toBe(true);
  });

  it("parse() rejects non-matching boolean literal", async () => {
    await expect(run($.zod.literal(true).parse(false))).rejects.toThrow();
  });

  it("safeParse() returns success for matching literal", async () => {
    const result = (await run($.zod.literal("tuna").safeParse("tuna"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("tuna");
  });

  it("safeParse() returns failure for non-matching literal", async () => {
    const result = (await run($.zod.literal("tuna").safeParse("salmon"))) as any;
    expect(result.success).toBe(false);
  });

  it("multi-value literal accepts any of the values", async () => {
    const red = (await run($.zod.literal(["red", "green", "blue"]).safeParse("red"))) as any;
    const green = (await run($.zod.literal(["red", "green", "blue"]).safeParse("green"))) as any;
    const yellow = (await run($.zod.literal(["red", "green", "blue"]).safeParse("yellow"))) as any;
    expect(red.success).toBe(true);
    expect(green.success).toBe(true);
    expect(yellow.success).toBe(false);
  });
});
