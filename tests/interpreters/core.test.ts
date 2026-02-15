import { describe, expect, it } from "vitest";
import { composeInterpreters, mvfm } from "../../src/core";
import { coreInterpreter } from "../../src/interpreters/core";

// Helper to inject input data into core/input nodes throughout an AST
function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") {
    result.__inputData = input;
  }
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter]);
  return await interp(ast.result);
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

describe("core interpreter: do", () => {
  it("returns last value", async () => {
    const prog = app(($) => $.do("step1", "step2", "result"));
    expect(await run(prog)).toBe("result");
  });
});
