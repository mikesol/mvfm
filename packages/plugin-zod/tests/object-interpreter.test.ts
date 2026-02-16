import {
  coreInterpreter,
  foldAST,
  injectInput,
  mvfm,
  type Program,
  strInterpreter,
} from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { createZodInterpreter, zod } from "../src/index";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const interp = { ...coreInterpreter, ...strInterpreter, ...createZodInterpreter() };
  return await foldAST(interp, injectInput(prog, input));
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
