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

const _app = mvfm(zod);
const appWithStr = mvfm(zod, str);

describe("zodInterpreter: refinements (#135)", () => {
  it("refine() passes when predicate returns true", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .refine((val) => $.startsWith(val, "hello"))
        .parse($.input.value),
    );
    expect(await run(prog, { value: "hello world" })).toBe("hello world");
  });

  it("refine() throws when predicate returns false", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .refine((val) => $.startsWith(val, "hello"))
        .parse($.input.value),
    );
    await expect(run(prog, { value: "goodbye" })).rejects.toThrow("Refinement failed");
  });

  it("refine() uses custom error message", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .refine((val) => $.startsWith(val, "hello"), { error: "Must start with hello" })
        .parse($.input.value),
    );
    await expect(run(prog, { value: "goodbye" })).rejects.toThrow("Must start with hello");
  });

  it("check() passes when predicate returns true", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .check((val) => $.includes(val, "@"))
        .parse($.input.value),
    );
    expect(await run(prog, { value: "user@example.com" })).toBe("user@example.com");
  });

  it("check() throws when predicate returns false", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .check((val) => $.includes(val, "@"), { error: "Must contain @" })
        .parse($.input.value),
    );
    await expect(run(prog, { value: "no-at-sign" })).rejects.toThrow("Must contain @");
  });

  it("overwrite() transforms the validated value", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .overwrite((val) => $.upper(val))
        .parse($.input.value),
    );
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });

  it("chained refinements execute in order", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .overwrite((val) => $.upper(val))
        .refine((val) => $.startsWith(val, "HELLO"))
        .parse($.input.value),
    );
    // overwrite runs first → "HELLO", then refine checks startsWith("HELLO") → passes
    expect(await run(prog, { value: "hello" })).toBe("HELLO");
  });

  it("safeParse catches refinement failure", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .refine((val) => $.startsWith(val, "x"), { error: "Must start with x" })
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Must start with x");
  });

  it("safeParse returns refined value on success", async () => {
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .overwrite((val) => $.trim(val))
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: "  hello  " })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("hello");
  });

  it("refinements run after Zod checks", async () => {
    // min(3) check runs first via Zod, then refine predicate runs
    const prog = appWithStr(($) =>
      $.zod
        .string()
        .min(3)
        .refine((val) => $.endsWith(val, "!"))
        .safeParse($.input.value),
    );
    // Too short — Zod check fails before refinement runs
    const short = (await run(prog, { value: "hi" })) as any;
    expect(short.success).toBe(false);
    // Long enough but doesn't end with !
    const noExcl = (await run(prog, { value: "hello" })) as any;
    expect(noExcl.success).toBe(false);
    // Passes both
    const valid = (await run(prog, { value: "hello!" })) as any;
    expect(valid.success).toBe(true);
  });
});
