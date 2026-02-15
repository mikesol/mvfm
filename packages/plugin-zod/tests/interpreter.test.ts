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
describe("zodInterpreter: tuple schemas (#148)", () => {
  it("tuple of strings accepts valid input", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string(), $.zod.string()]).parse($.input.value));
    expect(await run(prog, { value: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("tuple rejects non-array input", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: "not a tuple" })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple rejects wrong number of elements", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string(), $.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: ["only one"] })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple rejects wrong element types", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: [42] })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple with rest element accepts extra elements", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()], $.zod.string()).parse($.input.value));
    expect(await run(prog, { value: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("tuple with rest element validates rest type", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()], $.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", 42] })) as any;
    expect(result.success).toBe(false);
  });

  it("empty tuple accepts empty array", async () => {
    const prog = app(($) => $.zod.tuple([]).parse($.input.value));
    expect(await run(prog, { value: [] })).toEqual([]);
  });

  it("schema-level error appears in output", async () => {
    const prog = app(($) =>
      $.zod.tuple([$.zod.string()], undefined, "Must be tuple!").safeParse($.input.value),
    );
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be tuple!");
  });

  it("optional tuple works", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: ["a"] })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(valid.data).toEqual(["a"]);
  });
});

describe("zodInterpreter: union/xor schemas (#149)", () => {
  it("union accepts value matching first option", async () => {
    const prog = app(($) =>
      $.zod.union([$.zod.string().min(1), $.zod.string().min(5)]).parse($.input.value),
    );
    expect(await run(prog, { value: "hi" })).toBe("hi");
  });

  it("union rejects non-matching input", async () => {
    const prog = app(($) => $.zod.union([$.zod.string(), $.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });

  it("union with schema-level error", async () => {
    const prog = app(($) =>
      $.zod.union([$.zod.string(), $.zod.string()], "Must match!").safeParse($.input.value),
    );
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must match!");
  });

  it("union with optional wrapper", async () => {
    const prog = app(($) =>
      $.zod.union([$.zod.string(), $.zod.string()]).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "hi" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("xor accepts value matching exactly one option", async () => {
    const prog = app(($) =>
      $.zod.xor([$.zod.string().min(5), $.zod.string().max(3)]).parse($.input.value),
    );
    // "hello!" matches min(5) but not max(3) → exactly one match → passes
    expect(await run(prog, { value: "hello!" })).toBe("hello!");
  });

  it("xor rejects non-matching input", async () => {
    const prog = app(($) => $.zod.xor([$.zod.string(), $.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });
});
