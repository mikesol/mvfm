import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: array schemas (#147)", () => {
  it("array rejects non-array input", async () => {
    const result = (await run($.zod.array($.zod.string()).safeParse("not an array"))) as any;
    expect(result.success).toBe(false);
  });

  it("array rejects number input", async () => {
    const result = (await run($.zod.array($.zod.string()).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });

  it("schema-level error appears in output", async () => {
    const result = (await run($.zod.array($.zod.string(), "Must be array!").safeParse(42))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be array!");
  });
});
