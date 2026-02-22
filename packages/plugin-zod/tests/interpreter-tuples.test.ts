import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: tuple schemas (#148)", () => {
  it("tuple rejects non-tuple input (string)", async () => {
    const result = (await run($.zod.tuple([$.zod.string()]).safeParse("a"))) as any;
    expect(result.success).toBe(false);
  });

  it("tuple rejects wrong element types", async () => {
    const result = (await run($.zod.tuple([$.zod.string()]).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });

  it("schema-level error appears in output", async () => {
    const result = (await run(
      $.zod.tuple([$.zod.string()], undefined, "Must be tuple!").safeParse(42),
    )) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be tuple!");
  });
});
