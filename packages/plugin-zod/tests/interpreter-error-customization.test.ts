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

const app = mvfm(zod);
const _appWithStr = mvfm(zod, str);

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
