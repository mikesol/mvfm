import { coreInterpreter, foldAST, mvfm, strInterpreter } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

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
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, ast.result);
}

const app = mvfm(zod);

describe("zodInterpreter: literal schemas (#144)", () => {
  it("parse() accepts matching string literal", async () => {
    const prog = app(($) => $.zod.literal("tuna").parse($.input.value));
    expect(await run(prog, { value: "tuna" })).toBe("tuna");
  });

  it("parse() rejects non-matching string literal", async () => {
    const prog = app(($) => $.zod.literal("tuna").parse($.input.value));
    await expect(run(prog, { value: "salmon" })).rejects.toThrow();
  });

  it("parse() accepts matching number literal", async () => {
    const prog = app(($) => $.zod.literal(42).parse($.input.value));
    expect(await run(prog, { value: 42 })).toBe(42);
  });

  it("parse() rejects non-matching number literal", async () => {
    const prog = app(($) => $.zod.literal(42).parse($.input.value));
    await expect(run(prog, { value: 99 })).rejects.toThrow();
  });

  it("parse() accepts matching boolean literal", async () => {
    const prog = app(($) => $.zod.literal(true).parse($.input.value));
    expect(await run(prog, { value: true })).toBe(true);
  });

  it("parse() rejects non-matching boolean literal", async () => {
    const prog = app(($) => $.zod.literal(true).parse($.input.value));
    await expect(run(prog, { value: false })).rejects.toThrow();
  });

  it("safeParse() returns success for matching literal", async () => {
    const prog = app(($) => $.zod.literal("tuna").safeParse($.input.value));
    const result = (await run(prog, { value: "tuna" })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toBe("tuna");
  });

  it("safeParse() returns failure for non-matching literal", async () => {
    const prog = app(($) => $.zod.literal("tuna").safeParse($.input.value));
    const result = (await run(prog, { value: "salmon" })) as any;
    expect(result.success).toBe(false);
  });

  it("multi-value literal accepts any of the values", async () => {
    const prog = app(($) => $.zod.literal(["red", "green", "blue"]).safeParse($.input.value));
    const red = (await run(prog, { value: "red" })) as any;
    const green = (await run(prog, { value: "green" })) as any;
    const yellow = (await run(prog, { value: "yellow" })) as any;
    expect(red.success).toBe(true);
    expect(green.success).toBe(true);
    expect(yellow.success).toBe(false);
  });

  it("literal with optional wrapper allows undefined", async () => {
    const prog = app(($) => $.zod.literal("tuna").optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "tuna" })) as any;
    const invalid = (await run(prog, { value: "salmon" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
