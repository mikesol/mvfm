import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: union/xor schemas (#149)", () => {
  it("union accepts value matching first option", async () => {
    expect(await run($.zod.union([$.zod.string().min(1), $.zod.string().min(5)]).parse("hi"))).toBe(
      "hi",
    );
  });

  it("union rejects non-matching input", async () => {
    const result = (await run($.zod.union([$.zod.string(), $.zod.string()]).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });

  it("union with schema-level error", async () => {
    const result = (await run(
      $.zod.union([$.zod.string(), $.zod.string()], "Must match!").safeParse(42),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must match!");
  });

  it("xor accepts value matching exactly one option", async () => {
    // "hello!" matches min(5) but not max(3) → exactly one match → passes
    expect(
      await run($.zod.xor([$.zod.string().min(5), $.zod.string().max(3)]).parse("hello!")),
    ).toBe("hello!");
  });

  it("xor rejects non-matching input", async () => {
    const result = (await run($.zod.xor([$.zod.string(), $.zod.string()]).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });
});
