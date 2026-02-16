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

describe("zodInterpreter: bigint schema (#140)", () => {
  it("bigint parse validates valid bigint input", async () => {
    const prog = app(($) => $.zod.bigint().parse($.input.value));
    expect(await run(prog, { value: 42n })).toBe(42n);
  });

  it("bigint parse rejects non-bigint", async () => {
    const prog = app(($) => $.zod.bigint().parse($.input.value));
    await expect(run(prog, { value: 42 })).rejects.toThrow();
  });

  it("gt check rejects values not greater than", async () => {
    const prog = app(($) => $.zod.bigint().gt(5n).safeParse($.input.value));
    const fail = (await run(prog, { value: 5n })) as any;
    const pass = (await run(prog, { value: 6n })) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("gte check accepts equal values", async () => {
    const prog = app(($) => $.zod.bigint().gte(5n).safeParse($.input.value));
    const pass = (await run(prog, { value: 5n })) as any;
    const fail = (await run(prog, { value: 4n })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("lt check rejects values not less than", async () => {
    const prog = app(($) => $.zod.bigint().lt(10n).safeParse($.input.value));
    const fail = (await run(prog, { value: 10n })) as any;
    const pass = (await run(prog, { value: 9n })) as any;
    expect(fail.success).toBe(false);
    expect(pass.success).toBe(true);
  });

  it("lte check accepts equal values", async () => {
    const prog = app(($) => $.zod.bigint().lte(10n).safeParse($.input.value));
    const pass = (await run(prog, { value: 10n })) as any;
    const fail = (await run(prog, { value: 11n })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("positive rejects zero and negative", async () => {
    const prog = app(($) => $.zod.bigint().positive().safeParse($.input.value));
    const zero = (await run(prog, { value: 0n })) as any;
    const neg = (await run(prog, { value: -1n })) as any;
    const pos = (await run(prog, { value: 1n })) as any;
    expect(zero.success).toBe(false);
    expect(neg.success).toBe(false);
    expect(pos.success).toBe(true);
  });

  it("nonnegative accepts zero", async () => {
    const prog = app(($) => $.zod.bigint().nonnegative().safeParse($.input.value));
    const zero = (await run(prog, { value: 0n })) as any;
    const neg = (await run(prog, { value: -1n })) as any;
    expect(zero.success).toBe(true);
    expect(neg.success).toBe(false);
  });

  it("negative rejects zero and positive", async () => {
    const prog = app(($) => $.zod.bigint().negative().safeParse($.input.value));
    const neg = (await run(prog, { value: -1n })) as any;
    const zero = (await run(prog, { value: 0n })) as any;
    expect(neg.success).toBe(true);
    expect(zero.success).toBe(false);
  });

  it("nonpositive accepts zero", async () => {
    const prog = app(($) => $.zod.bigint().nonpositive().safeParse($.input.value));
    const zero = (await run(prog, { value: 0n })) as any;
    const pos = (await run(prog, { value: 1n })) as any;
    expect(zero.success).toBe(true);
    expect(pos.success).toBe(false);
  });

  it("multipleOf checks divisibility", async () => {
    const prog = app(($) => $.zod.bigint().multipleOf(3n).safeParse($.input.value));
    const pass = (await run(prog, { value: 9n })) as any;
    const fail = (await run(prog, { value: 10n })) as any;
    expect(pass.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it("bigint with optional wrapper", async () => {
    const prog = app(($) => $.zod.bigint().optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: 42n })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });

  it("bigint schema-level error", async () => {
    const prog = app(($) => $.zod.bigint("Expected bigint").safeParse($.input.value));
    const result = (await run(prog, { value: "hello" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected bigint");
  });

  it("bigint check-level error", async () => {
    const prog = app(($) =>
      $.zod.bigint().gt(0n, { error: "Must be positive!" }).safeParse($.input.value),
    );
    const result = (await run(prog, { value: -5n })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be positive!");
  });
});
