import { describe, expect, it } from "vitest";
import { composeInterpreters, ilo } from "../../src/core";
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

function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const interp = composeInterpreters([coreInterpreter]);
  return interp(ast.result);
}

const app = ilo();

describe("core interpreter: literals", () => {
  it("number", () => {
    const prog = app((_$) => 42);
    expect(run(prog)).toBe(42);
  });

  it("string", () => {
    const prog = app((_$) => "hello");
    expect(run(prog)).toBe("hello");
  });

  it("boolean", () => {
    const prog = app((_$) => true);
    expect(run(prog)).toBe(true);
  });

  it("null", () => {
    const prog = app((_$) => null);
    expect(run(prog)).toBe(null);
  });
});

describe("core interpreter: input + prop_access", () => {
  it("$.input.x returns input value", () => {
    const prog = app({ x: "number" }, ($) => $.input.x);
    expect(run(prog, { x: 42 })).toBe(42);
  });

  it("$.input.user.name resolves nested input", () => {
    const prog = app({ user: { name: "string" } }, ($) => $.input.user.name);
    expect(run(prog, { user: { name: "alice" } })).toBe("alice");
  });
});

describe("core interpreter: records", () => {
  it("constructs object from fields", () => {
    const prog = app({ x: "number" }, ($) => ({ a: "label", b: $.input.x }));
    expect(run(prog, { x: 5 })).toEqual({ a: "label", b: 5 });
  });
});

describe("core interpreter: do", () => {
  it("returns last value", () => {
    const prog = app(($) => $.do("step1", "step2", "result"));
    expect(run(prog)).toBe("result");
  });
});
