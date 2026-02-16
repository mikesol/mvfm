import { coreInterpreter, foldAST, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consoleInterpreter } from "../../src";
import type { ConsoleMethodName } from "../../src/22.0.0";
import { consolePlugin } from "../../src/22.0.0";
import { type ConsoleClient, createConsoleInterpreter } from "../../src/22.0.0/interpreter";

const app = mvfm(num, str, consolePlugin());

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) result[k] = injectInput(v, input);
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: Array<{ method: string; args: unknown[] }> = [];
  const ast = injectInput(prog.ast, input);
  const mockClient: ConsoleClient = {
    async call(method: ConsoleMethodName, args: unknown[]) {
      captured.push({ method, args });
    },
  };
  const combined = { ...createConsoleInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, ast.result);
  return { captured, result };
}

describe("console interpreter", () => {
  it("exports a default ready-to-use interpreter", () => {
    expect(typeof consoleInterpreter["console/log"]).toBe("function");
  });

  it("calls console/log with resolved arguments", async () => {
    const prog = app(($) => $.console.log("hello", $.input.n));
    const { captured } = await run(prog, { n: 42 });
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("log");
    expect(captured[0].args).toEqual(["hello", 42]);
  });

  it("calls console/assert with condition and data", async () => {
    const prog = app(($) => $.console.assert($.input.ok, "message", { code: 500 }));
    const { captured } = await run(prog, { ok: false });
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("assert");
    expect(captured[0].args).toEqual([false, "message", { code: 500 }]);
  });

  it("supports label plus extra args for timeLog", async () => {
    const prog = app(($) => $.console.timeLog("timer", $.input.marker));
    const { captured } = await run(prog, { marker: "phase-2" });
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("timeLog");
    expect(captured[0].args).toEqual(["timer", "phase-2"]);
  });

  it("returns undefined for console operations", async () => {
    const prog = app(($) => $.console.log("x"));
    const { result } = await run(prog);
    expect(result).toBeUndefined();
  });
});
