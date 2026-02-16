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

describe("zodInterpreter: transform/pipe/preprocess (#155)", () => {
  it(".transform(fn) applies transform after validation", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .transform((val) => $.upper(val))
        .parse($.input.value),
    );
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });

  it(".transform(fn) rejects invalid input before transform runs", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .transform((val) => $.upper(val))
        .parse($.input.value),
    );
    await expect(run(prog, { value: 42 })).rejects.toThrow();
  });

  it(".transform(fn) with safeParse returns transformed data", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .transform((val) => $.trim(val))
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: "  hello  " })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it(".transform(fn) with safeParse returns failure for invalid input", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .transform((val) => $.upper(val))
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: 123 })) as any;
    expect(result.success).toBe(false);
  });

  it("chained transforms execute in order", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .transform((val) => $.trim(val))
        .transform((val) => $.upper(val))
        .parse($.input.value),
    );
    expect(await run(prog, { value: "  hello  " })).toBe("HELLO");
  });

  it(".transform(fn) with checks validates before transforming", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .min(3)
        .transform((val) => $.upper(val))
        .safeParse($.input.value),
    );
    const short = (await run(prog, { value: "hi" })) as any;
    expect(short.success).toBe(false);
    const valid = (await run(prog, { value: "hello" })) as any;
    expect(valid.success).toBe(true);
    expect(valid.data).toBe("HELLO");
  });

  it(".pipe(target) validates through both schemas", async () => {
    const prog = app(($) => $.zod.string().pipe($.zod.string().min(3)).safeParse($.input.value));
    const short = (await run(prog, { value: "hi" })) as any;
    expect(short.success).toBe(false);
    const valid = (await run(prog, { value: "hello" })) as any;
    expect(valid.success).toBe(true);
  });

  it("$.zod.transform(fn) standalone transform with parse", async () => {
    const prog = appWithStr(($) => $.zod.transform((val) => $.upper(val)).parse($.input.value));
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });

  it("$.zod.transform(fn) standalone accepts any input type", async () => {
    const prog = app(($) => $.zod.transform((val) => val).parse($.input.value));
    expect(await run(prog, { value: 42 })).toBe(42);
    expect(await run(prog, { value: "hello" })).toBe("hello");
  });

  it("$.zod.preprocess(fn, schema) preprocesses before validation", async () => {
    const prog = appWithStr(($) =>
      $.zod.preprocess((val) => $.trim(val), $.zod.string().min(3)).safeParse($.input.value),
    );
    // "  hi  " → trimmed to "hi" → min(3) fails
    const short = (await run(prog, { value: "  hi  " })) as any;
    expect(short.success).toBe(false);
    // "  hello  " → trimmed to "hello" → min(3) passes
    const valid = (await run(prog, { value: "  hello  " })) as any;
    expect(valid.success).toBe(true);
    expect(valid.data).toBe("hello");
  });

  it("$.zod.preprocess(fn, schema) with parse", async () => {
    const prog = appWithStr(($) =>
      $.zod.preprocess((val) => $.upper(val), $.zod.string()).parse($.input.value),
    );
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });
});
