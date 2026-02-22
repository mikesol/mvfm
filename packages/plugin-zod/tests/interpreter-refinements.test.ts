import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: refinements (#135)", () => {
  it("refine() passes when predicate returns truthy value", async () => {
    // Identity function - non-empty string is truthy
    expect(
      await run(
        $.zod
          .string()
          .refine((val) => val)
          .parse("hello"),
      ),
    ).toBe("hello");
  });

  it("refine() throws when predicate returns falsy value", async () => {
    // Identity function - empty string is falsy
    await expect(
      run(
        $.zod
          .string()
          .refine((val) => val)
          .parse(""),
      ),
    ).rejects.toThrow("Refinement failed");
  });

  it("refine() uses custom error message", async () => {
    await expect(
      run(
        $.zod
          .string()
          .refine((val) => val, { error: "Must be non-empty" })
          .parse(""),
      ),
    ).rejects.toThrow("Must be non-empty");
  });

  it("safeParse catches refinement failure", async () => {
    const result = (await run(
      $.zod
        .string()
        .refine((val) => val, { error: "Must be non-empty" })
        .safeParse(""),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Must be non-empty");
  });

  it("refinements run after Zod checks", async () => {
    // min(3) check runs first via Zod, then refine predicate runs
    // Too short - Zod check fails before refinement runs
    const short = (await run(
      $.zod
        .string()
        .min(3)
        .refine((val) => val)
        .safeParse("hi"),
    )) as any;
    expect(short.success).toBe(false);
    // Long enough and truthy
    const valid = (await run(
      $.zod
        .string()
        .min(3)
        .refine((val) => val)
        .safeParse("hello"),
    )) as any;
    expect(valid.success).toBe(true);
  });
});
