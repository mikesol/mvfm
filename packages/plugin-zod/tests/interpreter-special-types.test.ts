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
const appWithStr = mvfm(zod, str);

describe("zodInterpreter: special types (#157)", () => {
  it("any() accepts any value", async () => {
    const prog = app(($) => $.zod.any().parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("hello");
    expect(await run(prog, { value: 42 })).toBe(42);
    expect(await run(prog, { value: null })).toBeNull();
    expect(await run(prog, { value: undefined })).toBeUndefined();
  });

  it("unknown() accepts any value", async () => {
    const prog = app(($) => $.zod.unknown().parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("hello");
    expect(await run(prog, { value: 42 })).toBe(42);
  });

  it("never() rejects all values", async () => {
    const prog = app(($) => $.zod.never().safeParse($.input.value));
    const str = (await run(prog, { value: "hello" })) as any;
    expect(str.success).toBe(false);
    const num = (await run(prog, { value: 42 })) as any;
    expect(num.success).toBe(false);
  });

  it("nan() accepts NaN", async () => {
    const prog = app(($) => $.zod.nan().safeParse($.input.value));
    const valid = (await run(prog, { value: Number.NaN })) as any;
    expect(valid.success).toBe(true);
    const invalid = (await run(prog, { value: 42 })) as any;
    expect(invalid.success).toBe(false);
  });

  it("custom(fn) validates with the predicate", async () => {
    const prog = appWithStr(($) =>
      $.zod.custom((val) => $.startsWith(val, "hello")).parse($.input.value),
    );
    expect(await run(prog, { value: "hello world" })).toBe("hello world");
  });

  it("custom(fn) rejects when predicate returns false", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .custom((val) => $.startsWith(val, "hello"), "Must start with hello")
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: "goodbye" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Must start with hello");
  });

  it("any() with optional wrapper", async () => {
    const prog = app(($) => $.zod.any().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    expect(undef.success).toBe(true);
    const valid = (await run(prog, { value: "hi" })) as any;
    expect(valid.success).toBe(true);
  });
});
