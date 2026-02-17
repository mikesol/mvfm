import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  type Program,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
}

const app = mvfm(zod);

describe("zodInterpreter: template literal schemas (#119)", () => {
  it("parse() accepts matching template literal with string", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input.value),
    );
    expect(await run(prog, { value: "hello, world!" })).toBe("hello, world!");
  });

  it("parse() rejects non-matching template literal", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input.value),
    );
    await expect(run(prog, { value: "goodbye, world!" })).rejects.toThrow();
  });

  it("parse() accepts template literal with number and enum", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse($.input.value),
    );
    expect(await run(prog, { value: "42px" })).toBe("42px");
    expect(await run(prog, { value: "3.14em" })).toBe("3.14em");
  });

  it("parse() rejects template literal with wrong unit", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse($.input.value),
    );
    await expect(run(prog, { value: "42pt" })).rejects.toThrow();
  });

  it("safeParse() returns success for matching template literal", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).safeParse($.input.value),
    );
    const result = (await run(prog, { value: "hello, world!" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello, world!");
  });

  it("safeParse() returns failure for non-matching template literal", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).safeParse($.input.value),
    );
    const result = (await run(prog, { value: "goodbye, world!" })) as any;
    expect(result.success).toBe(false);
  });

  it("template literal with only static strings", async () => {
    const prog = app(($) => $.zod.templateLiteral(["hello"]).parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("hello");
    await expect(run(prog, { value: "hello!" })).rejects.toThrow();
  });

  it("template literal with optional wrapper allows undefined", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "hello, world!" })) as any;
    const invalid = (await run(prog, { value: "goodbye, world!" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
