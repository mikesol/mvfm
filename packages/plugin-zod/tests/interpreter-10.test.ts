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

describe("zodInterpreter: intersection schemas (#151)", () => {
  it("intersection validates against both schemas", async () => {
    const prog = app(($) =>
      $.zod.intersection($.zod.string(), $.zod.string().min(3)).parse($.input.value),
    );
    expect(await run(prog, { value: "hello" })).toBe("hello");
  });

  it("intersection rejects if left schema fails", async () => {
    const prog = app(($) =>
      $.zod.intersection($.zod.string(), $.zod.string()).safeParse($.input.value),
    );
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
  });

  it("intersection rejects if right schema fails", async () => {
    const prog = app(($) =>
      $.zod.intersection($.zod.string(), $.zod.string().min(10)).safeParse($.input.value),
    );
    const result = (await run(prog, { value: "hi" })) as any;
    expect(result.success).toBe(false);
  });

  it("optional intersection works", async () => {
    const prog = app(($) =>
      $.zod.intersection($.zod.string(), $.zod.string()).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: "hi" })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });
});
