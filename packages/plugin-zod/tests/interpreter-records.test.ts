import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: record schemas (#152)", () => {
  it("record rejects non-string input", async () => {
    const result = (await run(
      $.zod.record($.zod.string(), $.zod.string()).safeParse("not an object"),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("record rejects number input", async () => {
    const result = (await run($.zod.record($.zod.string(), $.zod.string()).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });
});
