import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: primitives (#141)", () => {
  it("boolean() accepts true/false", async () => {
    const t = (await run($.zod.boolean().safeParse(true))) as any;
    expect(t.success).toBe(true);
    expect(t.data).toBe(true);
    const f = (await run($.zod.boolean().safeParse(false))) as any;
    expect(f.success).toBe(true);
    expect(f.data).toBe(false);
  });

  it("boolean() rejects non-boolean", async () => {
    const result = (await run($.zod.boolean().safeParse("true"))) as any;
    expect(result.success).toBe(false);
  });

  it("boolean() custom error", async () => {
    const result = (await run($.zod.boolean("Must be bool!").safeParse(42))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be bool!");
  });

  it("boolean with optional wrapper", async () => {
    const valid = (await run($.zod.boolean().optional().safeParse(true))) as any;
    expect(valid.success).toBe(true);
  });
});
