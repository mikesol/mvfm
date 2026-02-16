import { composeInterpreters, coreInterpreter, mvfm, strInterpreter } from "@mvfm/core";
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

describe("zodInterpreter: object schema (#146)", () => {
  it("object parse validates valid input", async () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).parse($.input.value));
    const result = await run(prog, { value: { name: "Alice" } });
    expect(result).toEqual({ name: "Alice" });
  });

  it("object parse rejects invalid field type", async () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).parse($.input.value));
    await expect(run(prog, { value: { name: 42 } })).rejects.toThrow();
  });

  it("object parse rejects non-object input", async () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).parse($.input.value));
    await expect(run(prog, { value: "not-object" })).rejects.toThrow();
  });

  it("strip mode (default) drops unknown keys", async () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string() }).safeParse($.input.value));
    const result = (await run(prog, { value: { name: "Alice", extra: true } })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Alice" });
  });

  it("strict mode rejects unknown keys", async () => {
    const prog = app(($) => $.zod.strictObject({ name: $.zod.string() }).safeParse($.input.value));
    const result = (await run(prog, { value: { name: "Alice", extra: true } })) as any;
    expect(result.success).toBe(false);
  });

  it("loose mode passes unknown keys through", async () => {
    const prog = app(($) => $.zod.looseObject({ name: $.zod.string() }).safeParse($.input.value));
    const result = (await run(prog, { value: { name: "Alice", extra: true } })) as any;
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Alice", extra: true });
  });

  it("nested object validates recursively", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          user: $.zod.object({ name: $.zod.string() }),
        })
        .parse($.input.value),
    );
    const result = await run(prog, { value: { user: { name: "Bob" } } });
    expect(result).toEqual({ user: { name: "Bob" } });
  });

  it("nested object rejects invalid inner field", async () => {
    const prog = app(($) =>
      $.zod
        .object({
          user: $.zod.object({ name: $.zod.string() }),
        })
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: { user: { name: 123 } } })) as any;
    expect(result.success).toBe(false);
  });

  it("object with string checks on fields", async () => {
    const prog = app(($) => $.zod.object({ name: $.zod.string().min(3) }).safeParse($.input.value));
    const short = (await run(prog, { value: { name: "Al" } })) as any;
    const valid = (await run(prog, { value: { name: "Alice" } })) as any;
    expect(short.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it("object with optional field via wrapper", async () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.number().optional() })
        .safeParse($.input.value),
    );
    const withAge = (await run(prog, { value: { name: "Alice", age: 30 } })) as any;
    const noAge = (await run(prog, { value: { name: "Alice" } })) as any;
    expect(withAge.success).toBe(true);
    expect(noAge.success).toBe(true);
  });

  it("object-level error appears in validation output", async () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }, "Expected an object").safeParse($.input.value),
    );
    const result = (await run(prog, { value: "not-object" })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Expected an object");
  });

  it("catchall schema validates unknown keys", async () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }).catchall($.zod.number()).safeParse($.input.value),
    );
    const valid = (await run(prog, { value: { name: "Alice", score: 42 } })) as any;
    const invalid = (await run(prog, {
      value: { name: "Alice", score: "bad" },
    })) as any;
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("partial object accepts missing fields", async () => {
    const prog = app(($) =>
      $.zod
        .object({ name: $.zod.string(), age: $.zod.number() })
        .partial()
        .safeParse($.input.value),
    );
    const result = (await run(prog, { value: {} })) as any;
    expect(result.success).toBe(true);
  });

  it("object with optional wrapper on entire schema", async () => {
    const prog = app(($) =>
      $.zod.object({ name: $.zod.string() }).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: { name: "Alice" } })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });
});
