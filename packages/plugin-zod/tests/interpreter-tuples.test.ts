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

describe("zodInterpreter: tuple schemas (#148)", () => {
  it("tuple of strings accepts valid input", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string(), $.zod.string()]).parse($.input.value));
    expect(await run(prog, { value: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("tuple rejects non-array input", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: "not a tuple" })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple rejects wrong number of elements", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string(), $.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: ["only one"] })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple rejects wrong element types", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).safeParse($.input.value));
    const result = (await run(prog, { value: [42] })) as any;
    expect(result.success).toBe(false);
  });

  it("tuple with rest element accepts extra elements", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()], $.zod.string()).parse($.input.value));
    expect(await run(prog, { value: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("tuple with rest element validates rest type", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()], $.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: ["a", 42] })) as any;
    expect(result.success).toBe(false);
  });

  it("empty tuple accepts empty array", async () => {
    const prog = app(($) => $.zod.tuple([]).parse($.input.value));
    expect(await run(prog, { value: [] })).toEqual([]);
  });

  it("schema-level error appears in output", async () => {
    const prog = app(($) =>
      $.zod.tuple([$.zod.string()], undefined, "Must be tuple!").safeParse($.input.value),
    );
    const result = (await run(prog, { value: 42 })) as any;
    expect(result.success).toBe(false);
    expect(result.error.message).toContain("Must be tuple!");
  });

  it("optional tuple works", async () => {
    const prog = app(($) => $.zod.tuple([$.zod.string()]).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    const valid = (await run(prog, { value: ["a"] })) as any;
    expect(undef.success).toBe(true);
    expect(valid.success).toBe(true);
    expect(valid.data).toEqual(["a"]);
  });
});
