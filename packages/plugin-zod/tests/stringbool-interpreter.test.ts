import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: stringbool schemas (#156)", () => {
  it("parse() coerces 'true' to true", async () => {
    expect(await run($.zod.stringbool().parse("true"))).toBe(true);
  });

  it("parse() coerces 'false' to false", async () => {
    expect(await run($.zod.stringbool().parse("false"))).toBe(false);
  });

  it("parse() coerces '1' to true and '0' to false", async () => {
    expect(await run($.zod.stringbool().parse("1"))).toBe(true);
    expect(await run($.zod.stringbool().parse("0"))).toBe(false);
  });

  it("parse() coerces 'yes'/'no' to true/false", async () => {
    expect(await run($.zod.stringbool().parse("yes"))).toBe(true);
    expect(await run($.zod.stringbool().parse("no"))).toBe(false);
  });

  it("parse() rejects non-boolean strings", async () => {
    await expect(run($.zod.stringbool().parse("maybe"))).rejects.toThrow();
  });

  it("custom truthy/falsy values", async () => {
    expect(await run($.zod.stringbool({ truthy: ["yep"], falsy: ["nah"] }).parse("yep"))).toBe(
      true,
    );
    expect(await run($.zod.stringbool({ truthy: ["yep"], falsy: ["nah"] }).parse("nah"))).toBe(
      false,
    );
  });

  it("safeParse() returns success for valid input", async () => {
    const result = (await run($.zod.stringbool().safeParse("true"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  it("safeParse() returns failure for invalid input", async () => {
    const result = (await run($.zod.stringbool().safeParse("banana"))) as any;
    expect(result.success).toBe(false);
  });
});
