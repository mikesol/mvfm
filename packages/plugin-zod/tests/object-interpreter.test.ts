import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: object schema (#146)", () => {
  it("object parse rejects non-object input (string)", async () => {
    await expect(run($.zod.object({ name: $.zod.string() }).parse("not-object"))).rejects.toThrow();
  });

  it("object parse rejects non-object input (number)", async () => {
    await expect(run($.zod.object({ name: $.zod.string() }).parse(42))).rejects.toThrow();
  });

  it("object-level error appears in validation output", async () => {
    const result = (await run(
      $.zod.object({ name: $.zod.string() }, "Expected an object").safeParse("not-object"),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected an object");
  });
});
