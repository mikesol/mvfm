import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: coercion (#143)", () => {
  it("coerce.string() converts number to string", async () => {
    expect(await run($.zod.coerce.string().parse(42))).toBe("42");
  });

  it("coerce.string() converts boolean to string", async () => {
    expect(await run($.zod.coerce.string().parse(true))).toBe("true");
  });

  it("coerce.string() passes through actual strings", async () => {
    expect(await run($.zod.coerce.string().parse("hello"))).toBe("hello");
  });

  it("coerce.string() with min check after coercion", async () => {
    const short = (await run($.zod.coerce.string().min(5).safeParse(42))) as any;
    const valid = (await run($.zod.coerce.string().min(5).safeParse(12345))) as any;
    expect(short.success).toBe(false); // "42" is 2 chars
    expect(valid.success).toBe(true); // "12345" is 5 chars
  });

  it("coerce.string() with safeParse", async () => {
    const result = (await run($.zod.coerce.string().safeParse(99))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("99");
  });

  it("non-coerced string rejects numbers", async () => {
    const result = (await run($.zod.string().safeParse(42))) as any;
    expect(result.success).toBe(false);
  });

  it("coerce.number() converts string to number", async () => {
    expect(await run($.zod.coerce.number().parse("42"))).toBe(42);
  });

  it("coerce.number() converts boolean to number", async () => {
    expect(await run($.zod.coerce.number().parse(true))).toBe(1);
  });

  it("coerce.number() passes through actual numbers", async () => {
    expect(await run($.zod.coerce.number().parse(3.14))).toBe(3.14);
  });

  it("coerce.number() with gt check after coercion", async () => {
    const fail = (await run($.zod.coerce.number().gt(10).safeParse("5"))) as any;
    const pass = (await run($.zod.coerce.number().gt(10).safeParse("42"))) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("coerce.number() with safeParse", async () => {
    const result = (await run($.zod.coerce.number().safeParse("99"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe(99);
  });

  it("non-coerced number rejects strings", async () => {
    const result = (await run($.zod.number().safeParse("42"))) as any;
    expect(result.success).toBe(false);
  });
});
