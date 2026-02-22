import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: enum schemas (#145)", () => {
  it("enum accepts valid value", async () => {
    expect(await run($.zod.enum(["Salmon", "Tuna", "Trout"]).parse("Salmon"))).toBe("Salmon");
  });

  it("enum rejects invalid value", async () => {
    const result = (await run($.zod.enum(["Salmon", "Tuna", "Trout"]).safeParse("Bass"))) as any;
    expect(result.success).toBe(false);
  });

  it("enum with error config", async () => {
    const result = (await run($.zod.enum(["a", "b"], "Must be a or b").safeParse("c"))) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be a or b");
  });

  it("extract() validates only extracted values", async () => {
    const salmon = (await run(
      $.zod.enum(["Salmon", "Tuna", "Trout"]).extract(["Salmon", "Trout"]).safeParse("Salmon"),
    )) as any;
    const tuna = (await run(
      $.zod.enum(["Salmon", "Tuna", "Trout"]).extract(["Salmon", "Trout"]).safeParse("Tuna"),
    )) as any;
    expect(salmon.success).toBe(true);
    expect(tuna.success).toBe(false);
  });

  it("exclude() rejects excluded values", async () => {
    const salmon = (await run(
      $.zod.enum(["Salmon", "Tuna", "Trout"]).exclude(["Salmon"]).safeParse("Salmon"),
    )) as any;
    const tuna = (await run(
      $.zod.enum(["Salmon", "Tuna", "Trout"]).exclude(["Salmon"]).safeParse("Tuna"),
    )) as any;
    expect(salmon.success).toBe(false);
    expect(tuna.success).toBe(true);
  });

  it("nativeEnum accepts valid value", async () => {
    const MyEnum = { Salmon: 0, Tuna: 1, Trout: 2 } as const;
    expect(await run($.zod.nativeEnum(MyEnum).parse(0))).toBe(0);
  });

  it("nativeEnum rejects invalid value", async () => {
    const MyEnum = { Salmon: 0, Tuna: 1 } as const;
    const result = (await run($.zod.nativeEnum(MyEnum).safeParse(99))) as any;
    expect(result.success).toBe(false);
  });
});
