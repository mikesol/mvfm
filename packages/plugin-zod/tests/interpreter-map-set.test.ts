import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: map/set schemas (#153)", () => {
  it("map rejects non-Map input", async () => {
    const result = (await run(
      $.zod.map($.zod.string(), $.zod.string()).safeParse("not a map"),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("set rejects non-Set input", async () => {
    const result = (await run($.zod.set($.zod.string()).safeParse("not a set"))) as any;
    expect(result.success).toBe(false);
  });

  it("map rejects number input", async () => {
    const result = (await run($.zod.map($.zod.string(), $.zod.string()).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });
});
