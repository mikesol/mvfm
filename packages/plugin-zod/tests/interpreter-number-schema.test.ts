import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: number schema (#139)", () => {
  it("number parse validates valid number", async () => {
    expect(await run($.zod.number().parse(42))).toBe(42);
  });

  it("number parse rejects non-number", async () => {
    await expect(run($.zod.number().parse("hello"))).rejects.toThrow();
  });

  it("gt check rejects values not greater than", async () => {
    const fail = (await run($.zod.number().gt(5).safeParse(5))) as any;
    const pass = (await run($.zod.number().gt(5).safeParse(6))) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("gte check accepts equal values", async () => {
    const pass = (await run($.zod.number().gte(5).safeParse(5))) as any;
    const fail = (await run($.zod.number().gte(5).safeParse(4))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("lt check rejects values not less than", async () => {
    const fail = (await run($.zod.number().lt(10).safeParse(10))) as any;
    const pass = (await run($.zod.number().lt(10).safeParse(9))) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("lte check accepts equal values", async () => {
    const pass = (await run($.zod.number().lte(10).safeParse(10))) as any;
    const fail = (await run($.zod.number().lte(10).safeParse(11))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("positive rejects zero and negative", async () => {
    const zero = (await run($.zod.number().positive().safeParse(0))) as any;
    const neg = (await run($.zod.number().positive().safeParse(-1))) as any;
    const pos = (await run($.zod.number().positive().safeParse(1))) as any;
    expect(zero.success).toBe(false);
    expect(neg.success).toBe(false);
    expect(pos.success).toBe(true);
  });

  it("nonnegative accepts zero", async () => {
    const zero = (await run($.zod.number().nonnegative().safeParse(0))) as any;
    const neg = (await run($.zod.number().nonnegative().safeParse(-1))) as any;
    expect(zero.success).toBe(true);
    expect(neg.success).toBe(false);
  });

  it("negative rejects zero and positive", async () => {
    const neg = (await run($.zod.number().negative().safeParse(-1))) as any;
    const zero = (await run($.zod.number().negative().safeParse(0))) as any;
    expect(neg.success).toBe(true);
    expect(zero.success).toBe(false);
  });

  it("nonpositive accepts zero", async () => {
    const zero = (await run($.zod.number().nonpositive().safeParse(0))) as any;
    const pos = (await run($.zod.number().nonpositive().safeParse(1))) as any;
    expect(zero.success).toBe(true);
    expect(pos.success).toBe(false);
  });

  it("multipleOf checks divisibility", async () => {
    const pass = (await run($.zod.number().multipleOf(3).safeParse(9))) as any;
    const fail = (await run($.zod.number().multipleOf(3).safeParse(10))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("int variant rejects non-integers", async () => {
    const pass = (await run($.zod.int().safeParse(42))) as any;
    const fail = (await run($.zod.int().safeParse(3.14))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("int32 variant rejects out-of-range", async () => {
    const pass = (await run($.zod.int32().safeParse(100))) as any;
    const fail = (await run($.zod.int32().safeParse(2147483648))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("uint32 variant rejects negatives", async () => {
    const pass = (await run($.zod.uint32().safeParse(0))) as any;
    const fail = (await run($.zod.uint32().safeParse(-1))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("float64 variant rejects Infinity", async () => {
    const pass = (await run($.zod.float64().safeParse(3.14))) as any;
    const fail = (await run($.zod.float64().safeParse(Number.POSITIVE_INFINITY))) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("number check-level error appears in output", async () => {
    const result = (await run(
      $.zod.number().gt(0, { error: "Must be positive!" }).safeParse(-5),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be positive!");
  });

  it("number schema-level error appears in output", async () => {
    const result = (await run($.zod.number("Expected a number").safeParse("hello"))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected a number");
  });

  it("number with optional wrapper", async () => {
    // Note: can't lift undefined, so test with number values
    const valid = (await run($.zod.number().optional().safeParse(42))) as any;
    const invalid = (await run($.zod.number().optional().safeParse("hello"))) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
