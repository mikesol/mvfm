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

describe("zodInterpreter: enum schemas (#145)", () => {
  it("enum accepts valid value", async () => {
    const prog = app(($) => $.zod.enum(["Salmon", "Tuna", "Trout"]).parse($.input.value));
    expect(await run(prog, { value: "Salmon" })).toBe("Salmon");
  });

  it("enum rejects invalid value", async () => {
    const prog = app(($) => $.zod.enum(["Salmon", "Tuna", "Trout"]).safeParse($.input.value));
    const result = (await run(prog, { value: "Bass" })) as any;
    expect(result.success).toBe(false);
  });

  it("enum with error config", async () => {
    const prog = app(($) => $.zod.enum(["a", "b"], "Must be a or b").safeParse($.input.value));
    const result = (await run(prog, { value: "c" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be a or b");
  });

  it("extract() validates only extracted values", async () => {
    const prog = app(($) =>
      $.zod.enum(["Salmon", "Tuna", "Trout"]).extract(["Salmon", "Trout"]).safeParse($.input.value),
    );
    const salmon = (await run(prog, { value: "Salmon" })) as any;
    const tuna = (await run(prog, { value: "Tuna" })) as any;
    expect(salmon.success).toBe(true);
    expect(tuna.success).toBe(false);
  });

  it("exclude() rejects excluded values", async () => {
    const prog = app(($) =>
      $.zod.enum(["Salmon", "Tuna", "Trout"]).exclude(["Salmon"]).safeParse($.input.value),
    );
    const salmon = (await run(prog, { value: "Salmon" })) as any;
    const tuna = (await run(prog, { value: "Tuna" })) as any;
    expect(salmon.success).toBe(false);
    expect(tuna.success).toBe(true);
  });

  it("nativeEnum accepts valid value", async () => {
    const MyEnum = { Salmon: 0, Tuna: 1, Trout: 2 } as const;
    const prog = app(($) => $.zod.nativeEnum(MyEnum).parse($.input.value));
    expect(await run(prog, { value: 0 })).toBe(0);
  });

  it("nativeEnum rejects invalid value", async () => {
    const MyEnum = { Salmon: 0, Tuna: 1 } as const;
    const prog = app(($) => $.zod.nativeEnum(MyEnum).safeParse($.input.value));
    const result = (await run(prog, { value: 99 })) as any;
    expect(result.success).toBe(false);
  });

  it("enum with optional wrapper", async () => {
    const prog = app(($) => $.zod.enum(["a", "b"]).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "a" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });
});
