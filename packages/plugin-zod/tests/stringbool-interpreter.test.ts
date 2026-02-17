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

describe("zodInterpreter: stringbool schemas (#119)", () => {
  it("parse() accepts truthy values (default)", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "true" })).toBe(true);
    expect(await run(prog, { value: "1" })).toBe(true);
    expect(await run(prog, { value: "yes" })).toBe(true);
    expect(await run(prog, { value: "on" })).toBe(true);
    expect(await run(prog, { value: "y" })).toBe(true);
    expect(await run(prog, { value: "enabled" })).toBe(true);
  });

  it("parse() accepts falsy values (default)", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "false" })).toBe(false);
    expect(await run(prog, { value: "0" })).toBe(false);
    expect(await run(prog, { value: "no" })).toBe(false);
    expect(await run(prog, { value: "off" })).toBe(false);
    expect(await run(prog, { value: "n" })).toBe(false);
    expect(await run(prog, { value: "disabled" })).toBe(false);
  });

  it("parse() is case insensitive by default", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    expect(await run(prog, { value: "TRUE" })).toBe(true);
    expect(await run(prog, { value: "False" })).toBe(false);
    expect(await run(prog, { value: "YES" })).toBe(true);
    expect(await run(prog, { value: "No" })).toBe(false);
  });

  it("parse() rejects invalid values", async () => {
    const prog = app(($) => $.zod.stringbool().parse($.input.value));
    await expect(run(prog, { value: "invalid" })).rejects.toThrow();
    await expect(run(prog, { value: "maybe" })).rejects.toThrow();
  });

  it("parse() accepts custom truthy/falsy values", async () => {
    const prog = app(($) =>
      $.zod
        .stringbool({
          truthy: ["yes", "y", "1"],
          falsy: ["no", "n", "0"],
        })
        .parse($.input.value),
    );
    expect(await run(prog, { value: "yes" })).toBe(true);
    expect(await run(prog, { value: "y" })).toBe(true);
    expect(await run(prog, { value: "1" })).toBe(true);
    expect(await run(prog, { value: "no" })).toBe(false);
    expect(await run(prog, { value: "n" })).toBe(false);
    expect(await run(prog, { value: "0" })).toBe(false);
    // Default values should not work with custom lists
    await expect(run(prog, { value: "true" })).rejects.toThrow();
    await expect(run(prog, { value: "false" })).rejects.toThrow();
  });

  it("parse() respects case sensitivity option", async () => {
    const prog = app(($) =>
      $.zod
        .stringbool({
          case: "sensitive",
        })
        .parse($.input.value),
    );
    expect(await run(prog, { value: "true" })).toBe(true);
    expect(await run(prog, { value: "false" })).toBe(false);
    // Uppercase should not work with case sensitive
    await expect(run(prog, { value: "TRUE" })).rejects.toThrow();
    await expect(run(prog, { value: "FALSE" })).rejects.toThrow();
  });

  it("safeParse() returns success for valid stringbool", async () => {
    const prog = app(($) => $.zod.stringbool().safeParse($.input.value));
    const result = (await run(prog, { value: "true" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
  });

  it("safeParse() returns failure for invalid stringbool", async () => {
    const prog = app(($) => $.zod.stringbool().safeParse($.input.value));
    const result = (await run(prog, { value: "invalid" })) as any;
    expect(result.success).toBe(false);
  });

  it("stringbool with optional wrapper allows undefined", async () => {
    const prog = app(($) => $.zod.stringbool().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "true" })) as any;
    const invalid = (await run(prog, { value: "invalid" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(valid.data).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
