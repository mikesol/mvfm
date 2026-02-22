import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: wrapper types (#136)", () => {
  it("optional() accepts valid string", async () => {
    const valid = (await run($.zod.string().optional().safeParse("hi"))) as any;
    expect(valid.success).toBe(true);
  });

  it("optional() rejects invalid type", async () => {
    const invalid = (await run($.zod.string().optional().safeParse(42))) as any;
    expect(invalid.success).toBe(false);
  });

  it("default() provides fallback string value", async () => {
    // When given a valid value, passes through
    expect(await run($.zod.string().default("fallback").parse("given"))).toBe("given");
  });

  it("catch() provides fallback on validation error", async () => {
    expect(await run($.zod.string().catch("caught").parse(42))).toBe("caught");
    expect(await run($.zod.string().catch("caught").parse("ok"))).toBe("ok");
  });

  it("readonly() passes through values", async () => {
    expect(await run($.zod.string().readonly().parse("hi"))).toBe("hi");
  });

  it("brand() passes through values", async () => {
    expect(await run($.zod.string().brand("Email").parse("test@example.com"))).toBe(
      "test@example.com",
    );
  });

  it("wrapper with checks: string with min", async () => {
    const short = (await run($.zod.string().min(3).optional().safeParse("hi"))) as any;
    const valid = (await run($.zod.string().min(3).optional().safeParse("hello"))) as any;
    expect(short.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("prefault() provides pre-parse default for valid value", async () => {
    expect(await run($.zod.string().prefault("pre").parse("given"))).toBe("given");
  });
});
