import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consoleInterpreter } from "../../src";
import type { ConsoleMethodName } from "../../src/22.0.0";
import { consolePlugin } from "../../src/22.0.0";
import { type ConsoleClient, createConsoleInterpreter } from "../../src/22.0.0/interpreter";

const plugin = consolePlugin();
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{ method: string; args: unknown[] }> = [];
  const mockClient: ConsoleClient = {
    async call(method: ConsoleMethodName, args: unknown[]) {
      captured.push({ method, args });
    },
  };
  const nexpr = app(expr as any);
  const interp = defaults(plugins, {
    console: createConsoleInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { captured, result };
}

describe("console interpreter", () => {
  it("exports a default ready-to-use interpreter", () => {
    expect(typeof consoleInterpreter["console/log"]).toBe("function");
  });

  it("calls console/log with resolved arguments", async () => {
    const expr = $.console.log("hello", 42);
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("log");
    expect(captured[0].args).toEqual(["hello", 42]);
  });

  it("calls console/assert with condition and data", async () => {
    const expr = $.console.assert(false, "message");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("assert");
    expect(captured[0].args).toEqual([false, "message"]);
  });

  it("supports label plus extra args for timeLog", async () => {
    const expr = $.console.timeLog("timer", "phase-2");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("timeLog");
    expect(captured[0].args).toEqual(["timer", "phase-2"]);
  });

  it("returns undefined for console operations", async () => {
    const expr = $.console.log("x");
    const { captured, result } = await run(expr);
    expect(result).toBeUndefined();
    expect(captured).toHaveLength(1);
  });

  it("clear calls with zero arguments", async () => {
    const expr = $.console.clear();
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("clear");
    expect(captured[0].args).toEqual([]);
  });
});
