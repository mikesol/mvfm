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

describe("zodInterpreter: record schemas (#152)", () => {
  it("record accepts valid Record<string, string>", async () => {
    const prog = app(($) => $.zod.record($.zod.string(), $.zod.string()).parse($.input.value));
    expect(await run(prog, { value: { a: "hello", b: "world" } })).toEqual({
      a: "hello",
      b: "world",
    });
  });

  it("record accepts empty object", async () => {
    const prog = app(($) => $.zod.record($.zod.string(), $.zod.string()).parse($.input.value));
    expect(await run(prog, { value: {} })).toEqual({});
  });

  it("record rejects non-object input", async () => {
    const prog = app(($) => $.zod.record($.zod.string(), $.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: "not an object" })) as any;
    expect(result.success).toBe(false);
  });

  it("record rejects invalid value types", async () => {
    const prog = app(($) => $.zod.record($.zod.string(), $.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: { a: 42 } })) as any;
    expect(result.success).toBe(false);
  });

  it("partialRecord accepts valid input", async () => {
    const prog = app(($) =>
      $.zod.partialRecord($.zod.string(), $.zod.string()).parse($.input.value),
    );
    expect(await run(prog, { value: { x: "hi" } })).toEqual({ x: "hi" });
  });

  it("looseRecord accepts valid input", async () => {
    const prog = app(($) => $.zod.looseRecord($.zod.string(), $.zod.string()).parse($.input.value));
    expect(await run(prog, { value: { x: "hi" } })).toEqual({ x: "hi" });
  });

  it("optional record works", async () => {
    const prog = app(($) =>
      $.zod.record($.zod.string(), $.zod.string()).optional().safeParse($.input.value),
    );
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: { a: "b" } })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
  });
});
