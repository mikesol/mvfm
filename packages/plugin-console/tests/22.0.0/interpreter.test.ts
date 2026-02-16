import type { Program } from "@mvfm/core";
import { coreInterpreter, foldAST, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consoleInterpreter } from "../../src";
import type { ConsoleMethodName } from "../../src/22.0.0";
import { consolePlugin } from "../../src/22.0.0";
import { type ConsoleClient, createConsoleInterpreter } from "../../src/22.0.0/interpreter";

const app = mvfm(num, str, consolePlugin());

async function run(prog: Program, input: Record<string, unknown> = {}) {
  const captured: Array<{ method: string; args: unknown[] }> = [];
  const injected = injectInput(prog, input);
  const mockClient: ConsoleClient = {
    async call(method: ConsoleMethodName, args: unknown[]) {
      captured.push({ method, args });
    },
  };
  const combined = { ...createConsoleInterpreter(mockClient), ...coreInterpreter };
  const result = await foldAST(combined, injected);
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
