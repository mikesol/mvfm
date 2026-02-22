import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: intersection schemas (#151)", () => {
  it("intersection validates against both schemas", async () => {
    expect(
      await run($.zod.intersection($.zod.string(), $.zod.string().min(3)).parse("hello")),
    ).toBe("hello");
  });

  it("intersection rejects if left schema fails", async () => {
    const result = (await run(
      $.zod.intersection($.zod.string(), $.zod.string()).safeParse(42),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("intersection rejects if right schema fails", async () => {
    const result = (await run(
      $.zod.intersection($.zod.string(), $.zod.string().min(10)).safeParse("hi"),
    )) as any;
    expect(result.success).toBe(false);
  });
});
