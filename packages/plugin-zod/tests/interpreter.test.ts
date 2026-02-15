import { composeInterpreters, coreInterpreter, mvfm } from "@mvfm/core";
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
  const interp = composeInterpreters([coreInterpreter, zodInterpreter]);
  return await interp(ast.result);
}

const app = mvfm(zod);

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
