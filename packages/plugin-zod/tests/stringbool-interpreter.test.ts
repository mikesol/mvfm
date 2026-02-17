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

describe("zodInterpreter: stringbool schemas (#156)", () => {
  it("parse() coerces 'true' to true", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "true" })).toBe(true);
  });

  it("parse() coerces 'false' to false", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "false" })).toBe(false);
  });

  it("parse() coerces '1' to true and '0' to false", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "1" })).toBe(true);
    expect(await run(prog, { value: "0" })).toBe(false);
  });

  it("parse() coerces 'yes'/'no' to true/false", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "yes" })).toBe(true);
    expect(await run(prog, { value: "no" })).toBe(false);
  });

  it("parse() rejects non-boolean strings", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    await expect(run(prog, { value: "maybe" })).rejects.toThrow();
  });

  it("custom truthy/falsy values", async () => {
    const prog = app(($) =>
      $.zod.stringbool({ truthy: ["yep"], falsy: ["nah"] }).parse($.input.value),
    );
    expect(await run(prog, { value: "yep" })).toBe(true);
    expect(await run(prog, { value: "nah" })).toBe(false);
  });

  it("safeParse() returns success for valid input", async () => {
    const prog = app(($) => $.zod.stringbool().safeParse($.input.value));
    const result = (await run(prog, { value: "true" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  it("safeParse() returns failure for invalid input", async () => {
    const prog = app(($) => $.zod.stringbool().safeParse($.input.value));
    const result = (await run(prog, { value: "banana" })) as any;
    expect(result.success).toBe(false);
  });

  it("stringbool with optional wrapper", async () => {
    const prog = app(($) => $.zod.stringbool().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "true" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(valid.data).toBe(true);
  });
});
