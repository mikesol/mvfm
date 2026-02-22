import { describe, expect, it } from "vitest";
import { $, run } from "./test-helpers";

describe("zodInterpreter: template literal schemas (#156)", () => {
  it("parse() accepts matching template literal", async () => {
    expect(
      await run($.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse("hello, world!")),
    ).toBe("hello, world!");
  });

  it("parse() rejects non-matching template literal", async () => {
    await expect(
      run($.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse("goodbye")),
    ).rejects.toThrow();
  });

  it("template literal with number schema", async () => {
    expect(await run($.zod.templateLiteral([$.zod.number(), "px"]).parse("42px"))).toBe("42px");
  });

  it("template literal with number rejects invalid", async () => {
    await expect(
      run($.zod.templateLiteral([$.zod.number(), "px"]).parse("abcpx")),
    ).rejects.toThrow();
  });

  it("safeParse() returns success for match", async () => {
    const result = (await run(
      $.zod.templateLiteral(["v", $.zod.number()]).safeParse("v42"),
    )) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("v42");
  });

  it("safeParse() returns failure for non-match", async () => {
    const result = (await run(
      $.zod.templateLiteral(["v", $.zod.number()]).safeParse("xyz"),
    )) as any;
    expect(result.success).toBe(false);
  });

  it("template literal with enum-like parts", async () => {
    expect(
      await run(
        $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse("16px"),
      ),
    ).toBe("16px");
    expect(
      await run(
        $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse("1.5em"),
      ),
    ).toBe("1.5em");
  });
});
