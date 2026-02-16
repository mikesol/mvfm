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

describe("zodInterpreter: wrapper types (#136)", () => {
  it("optional() allows undefined", async () => {
    const prog = app(($) => $.zod.string().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "hi" })) as any;
    const invalid = (await run(prog, { value: 42 })) as any;
    expect(undef.success).toBe(true);
    expect(undef.data).toBeUndefined();
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("nullable() allows null", async () => {
    const prog = app(($) => $.zod.string().nullable().safeParse($.input.value));
    const nul = (await run(prog, { value: null })) as any;
    const valid = (await run(prog, { value: "hi" })) as any;
    expect(nul.success).toBe(true);
    expect(nul.data).toBeNull();
    expect(valid.success).toBe(true);
  });

  it("nullish() allows null and undefined", async () => {
    const prog = app(($) => $.zod.string().nullish().safeParse($.input.value));
    const nul = (await run(prog, { value: null })) as any;
    const undef = (await run(prog, { value: undefined })) as any;
    expect(nul.success).toBe(true);
    expect(undef.success).toBe(true);
  });

  it("default() provides fallback for undefined", async () => {
    const prog = app(($) => $.zod.string().default("fallback").parse($.input.value));
    expect(await run(prog, { value: undefined })).toBe("fallback");
    expect(await run(prog, { value: "given" })).toBe("given");
  });

  it("catch() provides fallback on validation error", async () => {
    const prog = app(($) => $.zod.string().catch("caught").parse($.input.value));
    expect(await run(prog, { value: 42 })).toBe("caught");
    expect(await run(prog, { value: "ok" })).toBe("ok");
  });

  it("readonly() passes through values", async () => {
    const prog = app(($) => $.zod.string().readonly().parse($.input.value));
    expect(await run(prog, { value: "hi" })).toBe("hi");
  });

  it("brand() passes through values", async () => {
    const prog = app(($) => $.zod.string().brand("Email").parse($.input.value));
    expect(await run(prog, { value: "test@example.com" })).toBe("test@example.com");
  });

  it("composed wrappers: optional().nullable()", async () => {
    const prog = app(($) => $.zod.string().optional().nullable().safeParse($.input.value));
    const nul = (await run(prog, { value: null })) as any;
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "hi" })) as any;
    expect(nul.success).toBe(true);
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("wrapper with checks: optional string with min", async () => {
    const prog = app(($) => $.zod.string().min(3).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const short = (await run(prog, { value: "hi" })) as any;
    const valid = (await run(prog, { value: "hello" })) as any;
    expect(undef.success).toBe(true);
    expect(short.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("prefault() provides pre-parse default", async () => {
    const prog = app(($) => $.zod.string().prefault("pre").parse($.input.value));
    expect(await run(prog, { value: undefined })).toBe("pre");
    expect(await run(prog, { value: "given" })).toBe("given");
  });
});
