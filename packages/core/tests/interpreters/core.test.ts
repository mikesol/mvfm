import { describe, expect, it } from "vitest";
import { mvfm } from "../../src/core";
import { foldAST } from "../../src/fold";
import { injectInput } from "../../src/inject";
import { coreInterpreter } from "../../src/interpreters/core";
import type { Program } from "../../src/types";

async function run(prog: Program, input: Record<string, unknown> = {}) {
  return await foldAST(coreInterpreter, injectInput(prog, input));
}

const app = mvfm();

describe("core interpreter: literals", () => {
  it("number", async () => {
    const prog = app((_$) => 42);
    expect(await run(prog)).toBe(42);
  });

  it("string", async () => {
    const prog = app((_$) => "hello");
    expect(await run(prog)).toBe("hello");
  });

  it("boolean", async () => {
    const prog = app((_$) => true);
    expect(await run(prog)).toBe(true);
  });

  it("null", async () => {
    const prog = app((_$) => null);
    expect(await run(prog)).toBe(null);
  });
});

describe("core interpreter: input + prop_access", () => {
  it("$.input.x returns input value", async () => {
    const prog = app({ x: "number" }, ($) => $.input.x);
    expect(await run(prog, { x: 42 })).toBe(42);
  });

  it("$.input.user.name resolves nested input", async () => {
    const prog = app({ user: { name: "string" } }, ($) => $.input.user.name);
    expect(await run(prog, { user: { name: "alice" } })).toBe("alice");
  });
});

describe("core interpreter: records", () => {
  it("constructs object from fields", async () => {
    const prog = app({ x: "number" }, ($) => ({ a: "label", b: $.input.x }));
    expect(await run(prog, { x: 5 })).toEqual({ a: "label", b: 5 });
  });
});

describe("core interpreter: begin", () => {
  it("returns last value", async () => {
    const prog = app(($) => $.begin("step1", "step2", "result"));
    expect(await run(prog)).toBe("result");
  });
});
