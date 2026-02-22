import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: discriminated union schemas (#113)", () => {
  it("discriminatedUnion rejects non-object input", async () => {
    const result = (await run(
      $.zod
        .discriminatedUnion("type", [
          $.zod.object({ type: $.zod.literal("a") }),
          $.zod.object({ type: $.zod.literal("b") }),
        ])
        .safeParse("not an object"),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("discriminatedUnion with schema-level error", async () => {
    const result = (await run(
      $.zod
        .discriminatedUnion(
          "kind",
          [$.zod.object({ kind: $.zod.literal("x") }), $.zod.object({ kind: $.zod.literal("y") })],
          "Must be x or y!",
        )
        .safeParse(42),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be x or y!");
  });

  it("throws when an option is not an object schema", async () => {
    await expect(
      run(
        $.zod
          .discriminatedUnion("type", [
            $.zod.string(),
            $.zod.object({ type: $.zod.literal("b"), count: $.zod.number() }),
          ])
          .parse("test"),
      ),
    ).rejects.toThrow(/option\[0\] must be a zod\/object schema/i);
  });

  it("throws when an option omits the discriminator key", async () => {
    await expect(
      run(
        $.zod
          .discriminatedUnion("type", [
            $.zod.object({ value: $.zod.string() }),
            $.zod.object({ type: $.zod.literal("b"), count: $.zod.number() }),
          ])
          .parse("test"),
      ),
    ).rejects.toThrow(/option\[0\] is missing discriminator "type"/i);
  });

  it("throws when discriminator field is not literal or enum-like", async () => {
    await expect(
      run(
        $.zod
          .discriminatedUnion("type", [
            $.zod.object({ type: $.zod.string(), value: $.zod.string() }),
            $.zod.object({ type: $.zod.literal("b"), count: $.zod.number() }),
          ])
          .parse("test"),
      ),
    ).rejects.toThrow(/option\[0\] discriminator "type" must be literal or enum-like/i);
  });
});
