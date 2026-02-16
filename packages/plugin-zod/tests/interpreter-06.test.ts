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

describe("zodInterpreter: string checks (#100 + #137)", () => {
  it("length() rejects wrong length", async () => {
    const prog = app(($) => $.zod.string().length(5).safeParse($.input.value));
    const short = (await run(prog, { value: "hi" })) as any;
    const exact = (await run(prog, { value: "hello" })) as any;
    const long = (await run(prog, { value: "toolong" })) as any;
    expect(short.success).toBe(false);
    expect(exact.success).toBe(true);
    expect(long.success).toBe(false);
  });

  it("regex() validates pattern", async () => {
    const prog = app(($) =>
      $.zod
        .string()
        .regex(/^[a-z]+$/)
        .safeParse($.input.value),
    );
    const valid = (await run(prog, { value: "hello" })) as any;
    const invalid = (await run(prog, { value: "Hello123" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("regex() respects flags", async () => {
    const prog = app(($) =>
      $.zod
        .string()
        .regex(/^hello$/i)
        .safeParse($.input.value),
    );
    const upper = (await run(prog, { value: "HELLO" })) as any;
    expect(upper.success).toBe(true);
  });

  it("startsWith() validates prefix", async () => {
    const prog = app(($) => $.zod.string().startsWith("hello").safeParse($.input.value));
    const valid = (await run(prog, { value: "hello world" })) as any;
    const invalid = (await run(prog, { value: "goodbye" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("endsWith() validates suffix", async () => {
    const prog = app(($) => $.zod.string().endsWith("!").safeParse($.input.value));
    const valid = (await run(prog, { value: "hello!" })) as any;
    const invalid = (await run(prog, { value: "hello" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("includes() validates substring", async () => {
    const prog = app(($) => $.zod.string().includes("@").safeParse($.input.value));
    const valid = (await run(prog, { value: "user@example.com" })) as any;
    const invalid = (await run(prog, { value: "no-at" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("uppercase() rejects lowercase", async () => {
    const prog = app(($) => $.zod.string().uppercase().safeParse($.input.value));
    const valid = (await run(prog, { value: "HELLO" })) as any;
    const invalid = (await run(prog, { value: "Hello" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("lowercase() rejects uppercase", async () => {
    const prog = app(($) => $.zod.string().lowercase().safeParse($.input.value));
    const valid = (await run(prog, { value: "hello" })) as any;
    const invalid = (await run(prog, { value: "Hello" })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("trim() strips whitespace", async () => {
    const prog = app(($) => $.zod.string().trim().parse($.input.value));
    expect(await run(prog, { value: "  hello  " })).toBe("hello");
  });

  it("toLowerCase() transforms to lowercase", async () => {
    const prog = app(($) => $.zod.string().toLowerCase().parse($.input.value));
    expect(await run(prog, { value: "HELLO" })).toBe("hello");
  });

  it("toUpperCase() transforms to uppercase", async () => {
    const prog = app(($) => $.zod.string().toUpperCase().parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });

  it("chained checks: min + startsWith + endsWith", async () => {
    const prog = app(($) =>
      $.zod.string().min(5).startsWith("h").endsWith("!").safeParse($.input.value),
    );
    const tooShort = (await run(prog, { value: "h!" })) as any;
    const wrongStart = (await run(prog, { value: "world!" })) as any;
    const valid = (await run(prog, { value: "hello!" })) as any;
    expect(tooShort.success).toBe(false);
    expect(wrongStart.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("check-level error on startsWith", async () => {
    const prog = app(($) =>
      $.zod.string().startsWith("x", { error: "Must start with x" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must start with x");
  });

  it("transforms + validations chain correctly", async () => {
    // trim first, then check min length
    const prog = app(($) => $.zod.string().trim().min(5).safeParse($.input.value));
    const trimmedTooShort = (await run(prog, { value: "   hi   " })) as any;
    const trimmedValid = (await run(prog, { value: "  hello  " })) as any;
    expect(trimmedTooShort.success).toBe(false);
    expect(trimmedValid.success).toBe(true);
  });
});
