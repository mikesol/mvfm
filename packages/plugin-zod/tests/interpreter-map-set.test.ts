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

describe("zodInterpreter: map/set schemas (#153)", () => {
  it("map accepts valid Map input", async () => {
    const prog = app(($) => $.zod.map($.zod.string(), $.zod.string()).parse($.input.value));
    const m = new Map([["a", "hello"]]);
    const result = await run(prog, { value: m });
    expect(result).toBeInstanceOf(Map);
    expect((result as Map<string, string>).get("a")).toBe("hello");
  });

  it("map rejects non-Map input", async () => {
    const prog = app(($) => $.zod.map($.zod.string(), $.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: "not a map" })) as any;
    expect(result.success).toBe(false);
  });

  it("set accepts valid Set input", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).parse($.input.value));
    const s = new Set(["a", "b"]);
    const result = await run(prog, { value: s });
    expect(result).toBeInstanceOf(Set);
    expect((result as Set<string>).has("a")).toBe(true);
  });

  it("set rejects non-Set input", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).safeParse($.input.value));
    const result = (await run(prog, { value: "not a set" })) as any;
    expect(result.success).toBe(false);
  });

  it("set min() rejects too-small sets", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).min(3).safeParse($.input.value));
    const result = (await run(prog, { value: new Set(["a"]) })) as any;
    expect(result.success).toBe(false);
  });

  it("set min() accepts large enough sets", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).min(2).safeParse($.input.value));
    const result = (await run(prog, { value: new Set(["a", "b"]) })) as any;
    expect(result.success).toBe(true);
  });

  it("set max() rejects too-large sets", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).max(2).safeParse($.input.value));
    const result = (await run(prog, { value: new Set(["a", "b", "c"]) })) as any;
    expect(result.success).toBe(false);
  });

  it("set size() rejects wrong-sized sets", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).size(2).safeParse($.input.value));
    const small = (await run(prog, { value: new Set(["a"]) })) as any;
    const exact = (await run(prog, { value: new Set(["a", "b"]) })) as any;
    expect(small.success).toBe(false);
    expect(exact.success).toBe(true);
  });

  it("optional set works", async () => {
    const prog = app(($) => $.zod.set($.zod.string()).optional().safeParse($.input.value));
    const undef = (await run(prog, { value: undefined })) as any;
    expect(undef.success).toBe(true);
  });
});
