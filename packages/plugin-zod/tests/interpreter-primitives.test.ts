import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  type Program,
  str,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
}

const app = mvfm(zod);
const _appWithStr = mvfm(zod, str);

describe("zodInterpreter: primitives (#141)", () => {
  it("boolean() accepts true/false", async () => {
    const prog = app(($) => $.zod.boolean().safeParse($.input.value));
    const t = (await run(prog, { value: true })) as any;
    expect(t.success).toBe(true);
    expect(t.data).toBe(true);
    const f = (await run(prog, { value: false })) as any;
    expect(f.success).toBe(true);
    expect(f.data).toBe(false);
  });

  it("boolean() rejects non-boolean", async () => {
    const prog = app(($) => $.zod.boolean().safeParse($.input.value));
    const result = (await run(prog, { value: "true" })) as any;
    expect(result.success).toBe(false);
  });

  it("boolean() custom error", async () => {
    const prog = app(($) => $.zod.boolean("Must be bool!").safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be bool!");
  });

  it("null() accepts null", async () => {
    const prog = app(($) => $.zod.null().safeParse($.input.value));
    const valid = (await run(prog, { value: null })) as any;
    expect(valid.success).toBe(true);
    expect(valid.data).toBeNull();
  });

  it("null() rejects non-null", async () => {
    const prog = app(($) => $.zod.null().safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
  });

  it("undefined() accepts undefined", async () => {
    const prog = app(($) => $.zod.undefined().safeParse($.input.value));
    const valid = (await run(prog, { value: undefined })) as any;
    expect(valid.success).toBe(true);
  });

  it("undefined() rejects defined values", async () => {
    const prog = app(($) => $.zod.undefined().safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
  });

  it("void() accepts undefined (alias for undefined)", async () => {
    const prog = app(($) => $.zod.void().safeParse($.input.value));
    const valid = (await run(prog, { value: undefined })) as any;
    expect(valid.success).toBe(true);
  });

  it("symbol() accepts symbols", async () => {
    const prog = app(($) => $.zod.symbol().safeParse($.input.value));
    const valid = (await run(prog, { value: Symbol("test") })) as any;
    expect(valid.success).toBe(true);
  });

  it("symbol() rejects non-symbols", async () => {
    const prog = app(($) => $.zod.symbol().safeParse($.input.value));
    const result = (await run(prog, { value: "symbol" })) as any;
    expect(result.success).toBe(false);
  });

  it("boolean with optional wrapper", async () => {
    const prog = app(($) => $.zod.boolean().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    expect(undef.success).toBe(true);
    const valid = (await run(prog, { value: true })) as any;
    expect(valid.success).toBe(true);
  });
});
