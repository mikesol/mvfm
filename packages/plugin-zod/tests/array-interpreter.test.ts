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

describe("zodInterpreter: array schemas (#147)", () => {
  it("array of strings accepts valid input", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).parse($.input.value));
    expect(await run(prog, { value: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("array of strings rejects non-array input", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: "not an array" })) as any;
    expect(result.success).toBe(false);
  });

  it("array rejects elements of wrong type", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: [1, 2, 3] })) as any;
    expect(result.success).toBe(false);
  });

  it("array accepts empty array", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).parse($.input.value));
    expect(await run(prog, { value: [] })).toEqual([]);
  });

  it("min() rejects too-short arrays", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).min(3).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", "b"] })) as any;
    expect(result.success).toBe(false);
  });

  it("min() accepts arrays meeting minimum", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).min(2).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", "b"] })) as any;
    expect(result.success).toBe(true);
  });

  it("max() rejects too-long arrays", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).max(2).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", "b", "c"] })) as any;
    expect(result.success).toBe(false);
  });

  it("max() accepts arrays within limit", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).max(3).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", "b"] })) as any;
    expect(result.success).toBe(true);
  });

  it("length() rejects wrong-length arrays", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).length(3).safeParse($.input.value));
    const short = (await run(prog, { value: ["a"] })) as any;
    const long = (await run(prog, { value: ["a", "b", "c", "d"] })) as any;
    expect(short.success).toBe(false);
    expect(long.success).toBe(false);
  });

  it("length() accepts exact-length arrays", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).length(3).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", "b", "c"] })) as any;
    expect(result.success).toBe(true);
  });

  it("chained min + max work together", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).min(2).max(4).safeParse($.input.value));
    const tooShort = (await run(prog, { value: ["a"] })) as any;
    const justRight = (await run(prog, { value: ["a", "b", "c"] })) as any;
    const tooLong = (await run(prog, { value: ["a", "b", "c", "d", "e"] })) as any;
    expect(tooShort.success).toBe(false);
    expect(justRight.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it("schema-level error appears in output", async () => {
    const prog = app(($) => $.zod.array($.zod.string(), "Must be array!").safeParse($.input.value));
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be array!");
  });

  it("check-level error on min()", async () => {
    const prog = app(($) =>
      $.zod.array($.zod.string()).min(3, { error: "Need 3+" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: ["a"] })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Need 3+");
  });

  it("nested arrays validate correctly", async () => {
    const prog = app(($) => $.zod.array($.zod.array($.zod.string())).parse($.input.value));
    expect(await run(prog, { value: [["a", "b"], ["c"]] })).toEqual([["a", "b"], ["c"]]);
  });

  it("nested arrays reject invalid inner elements", async () => {
    const prog = app(($) => $.zod.array($.zod.array($.zod.string())).safeParse($.input.value));
    const result = (await run(prog, { value: [["a", 1]] })) as any;
    expect(result.success).toBe(false);
  });

  it("optional array works", async () => {
    const prog = app(($) => $.zod.array($.zod.string()).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: ["a"] })) as any;
    expect(undef.success).toBe(true);
    expect(undef.data).toBeUndefined();
    expect(valid.success).toBe(true);
    expect(valid.data).toEqual(["a"]);
  });
});
