import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: bigint schema (#140)", () => {
  it("bigint parse rejects non-bigint (number)", async () => {
    await expect(run($.zod.bigint().parse(42))).rejects.toThrow();
  });

  it("bigint parse rejects non-bigint (string)", async () => {
    await expect(run($.zod.bigint().parse("hello"))).rejects.toThrow();
  });

  it("bigint schema-level error", async () => {
    const result = (await run($.zod.bigint("Expected bigint").safeParse("hello"))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected bigint");
  });
});
