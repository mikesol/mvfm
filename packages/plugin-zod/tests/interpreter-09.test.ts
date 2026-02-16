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
