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

describe("zodInterpreter: parse operations (#133)", () => {
  it("parse() validates valid string input", async () => {
    const prog = app(($) => $.zod.string().parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("hello");
  });

  it("parse() throws on invalid input", async () => {
    const prog = app(($) => $.zod.string().parse($.input.value));
    await expect(run(prog, { value: 42 })).rejects.toThrow();
  });

  it("safeParse() returns success for valid input", async () => {
    const prog = app(($) => $.zod.string().safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it("safeParse() returns failure for invalid input", async () => {
    const prog = app(($) => $.zod.string().safeParse($.input.value));
    const result = (await run(prog, { value: 123 })) as any;
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("parseAsync() validates valid input", async () => {
    const prog = app(($) => $.zod.string().parseAsync($.input.value));
    expect(await run(prog, { value: "async-hello" })).toBe("async-hello");
  });

  it("parseAsync() throws on invalid input", async () => {
    const prog = app(($) => $.zod.string().parseAsync($.input.value));
    await expect(run(prog, { value: false })).rejects.toThrow();
  });

  it("safeParseAsync() returns success for valid input", async () => {
    const prog = app(($) => $.zod.string().safeParseAsync($.input.value));
    const result = (await run(prog, { value: "ok" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("ok");
  });

  it("safeParseAsync() returns failure for invalid input", async () => {
    const prog = app(($) => $.zod.string().safeParseAsync($.input.value));
    const result = (await run(prog, { value: null })) as any;
    expect(result.success).toBe(false);
  });

  it("string checks: min_length rejects short strings", async () => {
    const prog = app(($) => $.zod.string().min(5).safeParse($.input.value));
    const result = (await run(prog, { value: "hi" })) as any;
    expect(result.success).toBe(false);
  });

  it("string checks: min_length accepts valid strings", async () => {
    const prog = app(($) => $.zod.string().min(5).safeParse($.input.value));
    const result = (await run(prog, { value: "hello world" })) as any;
    expect(result.success).toBe(true);
  });

  it("string checks: max_length rejects long strings", async () => {
    const prog = app(($) => $.zod.string().max(3).safeParse($.input.value));
    const result = (await run(prog, { value: "toolong" })) as any;
    expect(result.success).toBe(false);
  });

  it("chained min + max checks work together", async () => {
    const prog = app(($) => $.zod.string().min(2).max(5).safeParse($.input.value));
    const tooShort = (await run(prog, { value: "a" })) as any;
    const justRight = (await run(prog, { value: "abc" })) as any;
    const tooLong = (await run(prog, { value: "abcdefg" })) as any;
    expect(tooShort.success).toBe(false);
    expect(justRight.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });
});
