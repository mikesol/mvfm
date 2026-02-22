import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: date schema (#142)", () => {
  it("date parse rejects non-date (string)", async () => {
    await expect(run($.zod.date().parse("not a date"))).rejects.toThrow();
  });

  it("date parse rejects non-date (number)", async () => {
    await expect(run($.zod.date().parse(42))).rejects.toThrow();
  });

  it("date schema-level error", async () => {
    const result = (await run($.zod.date("Expected a date").safeParse("hello"))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected a date");
  });
});
