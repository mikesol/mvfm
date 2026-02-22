import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("lazy schema interpreter (#117)", () => {
  it("validates a simple lazy schema", async () => {
    expect(await run($.zod.lazy(() => $.zod.string()).parse("hello"))).toBe("hello");
  });

  it("lazy string rejects non-string", async () => {
    await expect(run($.zod.lazy(() => $.zod.string()).parse(42))).rejects.toThrow();
  });

  it("lazy with safeParse returns success", async () => {
    const result = (await run($.zod.lazy(() => $.zod.string()).safeParse("hello"))) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it("lazy with safeParse returns failure", async () => {
    const result = (await run($.zod.lazy(() => $.zod.string()).safeParse(42))) as any;
    expect(result.success).toBe(false);
  });
});
