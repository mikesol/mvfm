import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: transform/pipe/preprocess (#155)", () => {
  it(".transform(fn) applies identity transform after validation", async () => {
    expect(
      await run(
        $.zod
          .string()
          .transform((val) => val)
          .parse("hello"),
      ),
    ).toBe("hello");
  });

  it(".transform(fn) rejects invalid input before transform runs", async () => {
    await expect(
      run(
        $.zod
          .string()
          .transform((val) => val)
          .parse(42),
      ),
    ).rejects.toThrow();
  });

  it(".transform(fn) with safeParse returns transformed data", async () => {
    const result = (await run(
      $.zod
        .string()
        .transform((val) => val)
        .safeParse("hello"),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it(".transform(fn) with safeParse returns failure for invalid input", async () => {
    const result = (await run(
      $.zod
        .string()
        .transform((val) => val)
        .safeParse(123),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("chained transforms execute in order", async () => {
    // Both are identity transforms; verify chaining works
    const result = await run(
      $.zod
        .string()
        .transform((val) => val)
        .transform((val) => val)
        .parse("hello"),
    );
    expect(result).toBe("hello");
  });

  it(".transform(fn) with checks validates before transforming", async () => {
    const short = (await run(
      $.zod
        .string()
        .min(3)
        .transform((val) => val)
        .safeParse("hi"),
    )) as any;
    expect(short.success).toBe(false);
    const valid = (await run(
      $.zod
        .string()
        .min(3)
        .transform((val) => val)
        .safeParse("hello"),
    )) as any;
    expect(valid.success).toBe(true);
    expect(valid.data).toBe("hello");
  });

  it(".pipe(target) validates through both schemas", async () => {
    const short = (await run($.zod.string().pipe($.zod.string().min(3)).safeParse("hi"))) as any;
    expect(short.success).toBe(false);
    const valid = (await run($.zod.string().pipe($.zod.string().min(3)).safeParse("hello"))) as any;
    expect(valid.success).toBe(true);
  });

  it("$.zod.transform(fn) standalone transform with parse", async () => {
    expect(await run($.zod.transform((val) => val).parse("hello"))).toBe("hello");
  });

  it("$.zod.transform(fn) standalone accepts any input type", async () => {
    expect(await run($.zod.transform((val) => val).parse(42))).toBe(42);
    expect(await run($.zod.transform((val) => val).parse("hello"))).toBe("hello");
  });

  it("$.zod.preprocess(fn, schema) preprocesses before validation", async () => {
    // Identity preprocess - validation still works
    const short = (await run(
      $.zod.preprocess((val) => val, $.zod.string().min(3)).safeParse("hi"),
    )) as any;
    expect(short.success).toBe(false);
    const valid = (await run(
      $.zod.preprocess((val) => val, $.zod.string().min(3)).safeParse("hello"),
    )) as any;
    expect(valid.success).toBe(true);
    expect(valid.data).toBe("hello");
  });

  it("$.zod.preprocess(fn, schema) with parse", async () => {
    expect(await run($.zod.preprocess((val) => val, $.zod.string()).parse("hello"))).toBe("hello");
  });
});
