import type { Program } from "@mvfm/core";
import { coreInterpreter, injectInput, mvfm, num, str } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { consolePlugin } from "../../src/22.0.0";
import { wrapConsole } from "../../src/22.0.0/client-console";
import { serverEvaluate } from "../../src/22.0.0/handler.server";

type Call = { method: string; args: unknown[] };

function createCapturingConsole() {
  const calls: Call[] = [];
  const make =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };

  const target = {
    assert: make("assert"),
    clear: make("clear"),
    count: make("count"),
    countReset: make("countReset"),
    debug: make("debug"),
    dir: make("dir"),
    dirxml: make("dirxml"),
    error: make("error"),
    group: make("group"),
    groupCollapsed: make("groupCollapsed"),
    groupEnd: make("groupEnd"),
    info: make("info"),
    log: make("log"),
    table: make("table"),
    time: make("time"),
    timeEnd: make("timeEnd"),
    timeLog: make("timeLog"),
    trace: make("trace"),
    warn: make("warn"),
  };

  return { target, calls };
}

const app = mvfm(num, str, consolePlugin());
async function run(prog: Program, target: unknown, input: Record<string, unknown> = {}) {
  const injected = injectInput(prog, input);
  const evaluate = serverEvaluate(wrapConsole(target as any), coreInterpreter);
  return await evaluate(injected.ast.result);
}

describe("console integration", () => {
  it("forwards all console methods to runtime adapter", async () => {
    const { target, calls } = createCapturingConsole();
    const cases: ReadonlyArray<{ method: string; args: unknown[] }> = [
      { method: "assert", args: [true, "ok"] },
      { method: "clear", args: [] },
      { method: "count", args: ["c"] },
      { method: "countReset", args: ["c"] },
      { method: "debug", args: ["d", 1] },
      { method: "dir", args: [{ a: 1 }, { depth: 2 }] },
      { method: "dirxml", args: ["x"] },
      { method: "error", args: ["e"] },
      { method: "group", args: ["g"] },
      { method: "groupCollapsed", args: ["gc"] },
      { method: "groupEnd", args: [] },
      { method: "info", args: ["i"] },
      { method: "log", args: ["l", 2] },
      { method: "table", args: [[{ a: 1 }]] },
      { method: "time", args: ["t"] },
      { method: "timeEnd", args: ["t"] },
      { method: "timeLog", args: ["t", "m"] },
      { method: "trace", args: ["tr"] },
      { method: "warn", args: ["w"] },
    ];

    for (const c of cases) {
      const prog = app(($) => ($.console as any)[c.method](...c.args));
      await run(prog, target);
    }

    expect(calls).toHaveLength(cases.length);
    for (let i = 0; i < cases.length; i++) {
      expect(calls[i].method).toBe(cases[i].method);
      expect(calls[i].args).toEqual(cases[i].args);
    }
  });

  it("resolves input values before invoking runtime", async () => {
    const { target, calls } = createCapturingConsole();
    const prog = app({ ok: "boolean", detail: "string" }, ($) =>
      $.console.assert($.input.ok, $.input.detail),
    );

    await run(prog, target, { ok: false, detail: "failed" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ method: "assert", args: [false, "failed"] });
  });
});
