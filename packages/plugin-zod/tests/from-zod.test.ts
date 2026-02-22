import { describe, expect, it, vi } from "vitest";
import { z as nativeZod } from "zod";
import { $, run, schemaOf } from "./test-helpers";

describe("$.zod.from()", () => {
  it("converts nested object schemas into zod AST nodes", () => {
    const source = nativeZod.object({
      name: nativeZod.string().min(2),
      age: nativeZod.number().int().optional(),
      tags: nativeZod.array(nativeZod.string()).max(3),
    });

    const schema = schemaOf($.zod.from(source));
    expect(schema.kind).toBe("zod/object");
    expect(schema.shape.name.kind).toBe("zod/string");
    expect(schema.shape.name.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "min_length", value: 2 })]),
    );
    expect(schema.shape.age.kind).toBe("zod/optional");
    expect(schema.shape.age.inner.kind).toBe("zod/number");
    expect(schema.shape.tags.kind).toBe("zod/array");
  });

  it("maps runtime unions to zod/union", () => {
    const source = nativeZod.union([nativeZod.string(), nativeZod.number()]);

    const schema = schemaOf($.zod.from(source));
    expect(schema.kind).toBe("zod/union");
    expect(schema.options).toHaveLength(2);
  });

  it("preserves multi-value literals", async () => {
    const source = nativeZod.literal(["a", "b"]);
    const schema = schemaOf($.zod.from(source));
    expect(schema.kind).toBe("zod/literal");
    expect(schema.value).toEqual(["a", "b"]);
    expect(await run($.zod.from(source).safeParse("a"))).toMatchObject({ success: true });
    expect(await run($.zod.from(source).safeParse("c"))).toMatchObject({ success: false });
  });

  it("throws in strict mode when refinement closures are present", () => {
    const source = nativeZod.string().refine((val) => val.length > 0, { message: "required" });

    expect(() => $.zod.from(source)).toThrow(/refinement|closure|custom/i);
  });

  it("drops refinements and warns in non-strict mode", () => {
    const source = nativeZod.object({
      name: nativeZod.string().refine((val) => val.startsWith("a")),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const schema = schemaOf($.zod.from(source, { strict: false }));
      expect(schema.shape.name.refinements).toEqual([]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("throws in strict mode for exclusive date comparisons", () => {
    const source = nativeZod.date().min(new Date("2020-01-01"));
    const checkDef = (((source as any)._def.checks as any[])[0]?._zod?.def ??
      ((source as any)._def.checks as any[])[0]?.def) as { inclusive?: boolean };
    checkDef.inclusive = false;

    expect(() => $.zod.from(source)).toThrow(/exclusive|date|check/i);
  });

  it("preserves parse behavior for simple schemas", async () => {
    // Note: objects can't be lifted by createApp, so we test with simple types
    const source = nativeZod.string().min(2);

    const actualGood = (await run($.zod.from(source).safeParse("hello"))) as any;
    const actualBad = (await run($.zod.from(source).safeParse("j"))) as any;

    expect(actualGood.success).toBe(true);
    expect(actualBad.success).toBe(false);
  });
});
