import { coreInterpreter, foldAST, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consolePlugin } from "../../src/22.0.0";
import { consoleInterpreter } from "../../src/22.0.0/interpreter";

const app = mvfm(num, str, consolePlugin());
const fragments = [consoleInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) result[k] = injectInput(v, input);
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "console/assert": async (effect) => {
      captured.push(effect);
      return undefined;
    },
    "console/log": async (effect) => {
      captured.push(effect);
      return undefined;
    },
    "console/timeLog": async (effect) => {
      captured.push(effect);
      return undefined;
    },
  });
  const result = await recurse(ast.result);
  return { captured, result };
}

describe("console interpreter", () => {
  it("yields console/log effect with resolved arguments", async () => {
    const prog = app(($) => $.console.log("hello", $.input.n));
    const { captured } = await run(prog, { n: 42 });
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("console/log");
    expect(captured[0].args).toEqual(["hello", 42]);
  });

  it("yields console/assert effect with condition and data", async () => {
    const prog = app(($) => $.console.assert($.input.ok, "message", { code: 500 }));
    const { captured } = await run(prog, { ok: false });
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("console/assert");
    expect(captured[0].args).toEqual([false, "message", { code: 500 }]);
  });

  it("supports label plus extra args for timeLog", async () => {
    const prog = app(($) => $.console.timeLog("timer", $.input.marker));
    const { captured } = await run(prog, { marker: "phase-2" });
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("console/timeLog");
    expect(captured[0].args).toEqual(["timer", "phase-2"]);
  });

  it("returns undefined for console operations", async () => {
    const prog = app(($) => $.console.log("x"));
    const { result } = await run(prog);
    expect(result).toBeUndefined();
  });
});
