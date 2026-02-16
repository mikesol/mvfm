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

describe("zodInterpreter: number schema (#139)", () => {
  it("number parse validates valid number", async () => {
    const prog = app(($) => $.zod.number().parse($.input.value));
    expect(await run(prog, { value: 42 })).toBe(42);
  });

  it("number parse rejects non-number", async () => {
    const prog = app(($) => $.zod.number().parse($.input.value));
    await expect(run(prog, { value: "hello" })).rejects.toThrow();
  });

  it("gt check rejects values not greater than", async () => {
    const prog = app(($) => $.zod.number().gt(5).safeParse($.input.value));
    const fail = (await run(prog, { value: 5 })) as any;
    const pass = (await run(prog, { value: 6 })) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("gte check accepts equal values", async () => {
    const prog = app(($) => $.zod.number().gte(5).safeParse($.input.value));
    const pass = (await run(prog, { value: 5 })) as any;
    const fail = (await run(prog, { value: 4 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("lt check rejects values not less than", async () => {
    const prog = app(($) => $.zod.number().lt(10).safeParse($.input.value));
    const fail = (await run(prog, { value: 10 })) as any;
    const pass = (await run(prog, { value: 9 })) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("lte check accepts equal values", async () => {
    const prog = app(($) => $.zod.number().lte(10).safeParse($.input.value));
    const pass = (await run(prog, { value: 10 })) as any;
    const fail = (await run(prog, { value: 11 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("positive rejects zero and negative", async () => {
    const prog = app(($) => $.zod.number().positive().safeParse($.input.value));
    const zero = (await run(prog, { value: 0 })) as any;
    const neg = (await run(prog, { value: -1 })) as any;
    const pos = (await run(prog, { value: 1 })) as any;
    expect(zero.success).toBe(false);
    expect(neg.success).toBe(false);
    expect(pos.success).toBe(true);
  });

  it("nonnegative accepts zero", async () => {
    const prog = app(($) => $.zod.number().nonnegative().safeParse($.input.value));
    const zero = (await run(prog, { value: 0 })) as any;
    const neg = (await run(prog, { value: -1 })) as any;
    expect(zero.success).toBe(true);
    expect(neg.success).toBe(false);
  });

  it("negative rejects zero and positive", async () => {
    const prog = app(($) => $.zod.number().negative().safeParse($.input.value));
    const neg = (await run(prog, { value: -1 })) as any;
    const zero = (await run(prog, { value: 0 })) as any;
    expect(neg.success).toBe(true);
    expect(zero.success).toBe(false);
  });

  it("nonpositive accepts zero", async () => {
    const prog = app(($) => $.zod.number().nonpositive().safeParse($.input.value));
    const zero = (await run(prog, { value: 0 })) as any;
    const pos = (await run(prog, { value: 1 })) as any;
    expect(zero.success).toBe(true);
    expect(pos.success).toBe(false);
  });

  it("multipleOf checks divisibility", async () => {
    const prog = app(($) => $.zod.number().multipleOf(3).safeParse($.input.value));
    const pass = (await run(prog, { value: 9 })) as any;
    const fail = (await run(prog, { value: 10 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("int variant rejects non-integers", async () => {
    const prog = app(($) => $.zod.int().safeParse($.input.value));
    const pass = (await run(prog, { value: 42 })) as any;
    const fail = (await run(prog, { value: 3.14 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("int32 variant rejects out-of-range", async () => {
    const prog = app(($) => $.zod.int32().safeParse($.input.value));
    const pass = (await run(prog, { value: 100 })) as any;
    const fail = (await run(prog, { value: 2147483648 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("uint32 variant rejects negatives", async () => {
    const prog = app(($) => $.zod.uint32().safeParse($.input.value));
    const pass = (await run(prog, { value: 0 })) as any;
    const fail = (await run(prog, { value: -1 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("float64 variant rejects Infinity", async () => {
    const prog = app(($) => $.zod.float64().safeParse($.input.value));
    const pass = (await run(prog, { value: 3.14 })) as any;
    const fail = (await run(prog, { value: Number.POSITIVE_INFINITY })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("nan() validates NaN specifically", async () => {
    const prog = app(($) => $.zod.nan().safeParse($.input.value));
    const pass = (await run(prog, { value: Number.NaN })) as any;
    const fail = (await run(prog, { value: 42 })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("number check-level error appears in output", async () => {
    const prog = app(($) =>
      $.zod.number().gt(0, { error: "Must be positive!" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: -5 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be positive!");
  });

  it("number schema-level error appears in output", async () => {
    const prog = app(($) => $.zod.number("Expected a number").safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected a number");
  });

  it("number with optional wrapper", async () => {
    const prog = app(($) => $.zod.number().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: 42 })) as any;
    const invalid = (await run(prog, { value: "hello" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
