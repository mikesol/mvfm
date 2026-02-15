import { composeInterpreters, coreInterpreter, mvfm, str, strInterpreter } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod, zodInterpreter } from "../src/index";

/** Inject input data into core/input nodes throughout the AST. */
function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

/** Build AST from DSL, inject input, compose interpreters, evaluate. */
async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter, strInterpreter, zodInterpreter]);
  return await interp(ast.result);
}

const app = mvfm(zod);
const appWithStr = mvfm(zod, str);

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

describe("zodInterpreter: error customization (#134)", () => {
  it("schema-level error appears in validation output", async () => {
    const prog = app(($) => $.zod.string("Must be a string!").safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be a string!");
  });

  it("schema-level error via object form", async () => {
    const prog = app(($) => $.zod.string({ error: "Bad type!" }).safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Bad type!");
  });

  it("check-level error on min()", async () => {
    const prog = app(($) =>
      $.zod.string().min(5, { error: "Too short!" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: "hi" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Too short!");
  });

  it("check-level error on max()", async () => {
    const prog = app(($) => $.zod.string().max(3, { error: "Too long!" }).safeParse($.input.value));
    const result = (await run(prog, { value: "toolong" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Too long!");
  });

  it("per-parse error appears in validation output", async () => {
    const prog = app(($) => $.zod.string().safeParse($.input.value, { error: "Parse failed!" }));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Parse failed!");
  });

  it("schema-level error takes precedence over parse-level error", async () => {
    const prog = app(($) =>
      $.zod.string("Schema error").safeParse($.input.value, { error: "Parse error" }),
    );
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    // In Zod v4, schema-level error is baked into the schema and takes precedence
    expect(result.error.message).toContain("Schema error");
  });

  it("no error config uses Zod default messages", async () => {
    const prog = app(($) => $.zod.string().safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    // Default Zod message, not custom
    expect(result.error.message).not.toContain("Must be");
    expect(result.error.message).toContain("invalid_type");
  });
});

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
