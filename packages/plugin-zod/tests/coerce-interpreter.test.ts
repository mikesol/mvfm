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

describe("zodInterpreter: coercion (#143)", () => {
  it("coerce.string() converts number to string", async () => {
    const prog = app(($) => $.zod.coerce.string().parse($.input.value));
    expect(await run(prog, { value: 42 })).toBe("42");
  });

  it("coerce.string() converts boolean to string", async () => {
    const prog = app(($) => $.zod.coerce.string().parse($.input.value));
    expect(await run(prog, { value: true })).toBe("true");
  });

  it("coerce.string() passes through actual strings", async () => {
    const prog = app(($) => $.zod.coerce.string().parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("hello");
  });

  it("coerce.string() with min check after coercion", async () => {
    const prog = app(($) => $.zod.coerce.string().min(5).safeParse($.input.value));
    const short = (await run(prog, { value: 42 })) as any;
    const valid = (await run(prog, { value: 12345 })) as any;
    expect(short.success).toBe(false); // "42" is 2 chars
    expect(valid.success).toBe(true); // "12345" is 5 chars
  });

  it("coerce.string() with safeParse", async () => {
    const prog = app(($) => $.zod.coerce.string().safeParse($.input.value));
    const result = (await run(prog, { value: 99 })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("99");
  });

  it("coerce.string() with optional wrapper", async () => {
    const prog = app(($) => $.zod.coerce.string().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const coerced = (await run(prog, { value: 42 })) as any;
    expect(undef.success).toBe(true);
    expect(undef.data).toBeUndefined();
    expect(coerced.success).toBe(true);
    expect(coerced.data).toBe("42");
  });

  it("non-coerced string rejects numbers", async () => {
    const prog = app(($) => $.zod.string().safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });

  it("coerce.number() converts string to number", async () => {
    const prog = app(($) => $.zod.coerce.number().parse($.input.value));
    expect(await run(prog, { value: "42" })).toBe(42);
  });

  it("coerce.number() converts boolean to number", async () => {
    const prog = app(($) => $.zod.coerce.number().parse($.input.value));
    expect(await run(prog, { value: true })).toBe(1);
  });

  it("coerce.number() passes through actual numbers", async () => {
    const prog = app(($) => $.zod.coerce.number().parse($.input.value));
    expect(await run(prog, { value: 3.14 })).toBe(3.14);
  });

  it("coerce.number() with gt check after coercion", async () => {
    const prog = app(($) => $.zod.coerce.number().gt(10).safeParse($.input.value));
    const fail = (await run(prog, { value: "5" })) as any;
    const pass = (await run(prog, { value: "42" })) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("coerce.number() with safeParse", async () => {
    const prog = app(($) => $.zod.coerce.number().safeParse($.input.value));
    const result = (await run(prog, { value: "99" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe(99);
  });

  it("coerce.number() with optional wrapper", async () => {
    const prog = app(($) => $.zod.coerce.number().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const coerced = (await run(prog, { value: "42" })) as any;
    expect(undef.success).toBe(true);
    expect(undef.data).toBeUndefined();
    expect(coerced.success).toBe(true);
    expect(coerced.data).toBe(42);
  });

  it("non-coerced number rejects strings", async () => {
    const prog = app(($) => $.zod.number().safeParse($.input.value));
    const result = (await run(prog, { value: "42" })) as any;
    expect(result.success).toBe(false);
  });
});
