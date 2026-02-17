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

describe("zodInterpreter: template literal schemas (#156)", () => {
  it("parse() accepts matching template literal", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input.value),
    );
    expect(await run(prog, { value: "hello, world!" })).toBe("hello, world!");
  });

  it("parse() rejects non-matching template literal", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input.value),
    );
    await expect(run(prog, { value: "goodbye" })).rejects.toThrow();
  });

  it("template literal with number schema", async () => {
    const prog = app(($) => $.zod.templateLiteral([$.zod.number(), "px"]).parse($.input.value));
    expect(await run(prog, { value: "42px" })).toBe("42px");
  });

  it("template literal with number rejects invalid", async () => {
    const prog = app(($) => $.zod.templateLiteral([$.zod.number(), "px"]).parse($.input.value));
    await expect(run(prog, { value: "abcpx" })).rejects.toThrow();
  });

  it("safeParse() returns success for match", async () => {
    const prog = app(($) => $.zod.templateLiteral(["v", $.zod.number()]).safeParse($.input.value));
    const result = (await run(prog, { value: "v42" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("v42");
  });

  it("safeParse() returns failure for non-match", async () => {
    const prog = app(($) => $.zod.templateLiteral(["v", $.zod.number()]).safeParse($.input.value));
    const result = (await run(prog, { value: "xyz" })) as any;
    expect(result.success).toBe(false);
  });

  it("template literal with enum-like parts", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse($.input.value),
    );
    expect(await run(prog, { value: "16px" })).toBe("16px");
    expect(await run(prog, { value: "1.5em" })).toBe("1.5em");
  });

  it("template literal with optional wrapper", async () => {
    const prog = app(($) =>
      $.zod.templateLiteral(["test", $.zod.number()]).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "test42" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });
});
