import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { pino } from "../../../../src/plugins/pino/10.3.1";
import { pinoInterpreter } from "../../../../src/plugins/pino/10.3.1/interpreter";
import { str } from "../../../../src/plugins/str";

const app = mvfm(num, str, pino({ level: "info" }));
const fragments = [pinoInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "pino/log": async (effect) => {
      captured.push(effect);
      return undefined;
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Info
// ============================================================

describe("pino interpreter: info with message", () => {
  it("yields pino/log effect with level info", async () => {
    const prog = app(($) => $.pino.info("hello world"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("pino/log");
    expect(captured[0].level).toBe("info");
    expect(captured[0].msg).toBe("hello world");
    expect(captured[0].mergeObject).toBeUndefined();
    expect(captured[0].bindings).toEqual([]);
  });
});

describe("pino interpreter: info with merge object and message", () => {
  it("yields pino/log with mergeObject", async () => {
    const prog = app(($) => $.pino.info({ userId: 123 }, "user action"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("pino/log");
    expect(captured[0].level).toBe("info");
    expect(captured[0].msg).toBe("user action");
    expect(captured[0].mergeObject).toEqual({ userId: 123 });
  });
});

// ============================================================
// Object-only logging
// ============================================================

describe("pino interpreter: object-only logging", () => {
  it("yields pino/log with mergeObject and no msg", async () => {
    const prog = app(($) => $.pino.info({ userId: 123 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("pino/log");
    expect(captured[0].mergeObject).toEqual({ userId: 123 });
    expect(captured[0].msg).toBeUndefined();
  });
});

// ============================================================
// All levels
// ============================================================

describe("pino interpreter: all six levels yield correct effect", () => {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  for (const level of levels) {
    it(`${level} yields pino/log with level="${level}"`, async () => {
      const prog = app(($) => ($.pino as any)[level]("test"));
      const { captured } = await run(prog);
      expect(captured).toHaveLength(1);
      expect(captured[0].type).toBe("pino/log");
      expect(captured[0].level).toBe(level);
      expect(captured[0].msg).toBe("test");
    });
  }
});

// ============================================================
// Child loggers
// ============================================================

describe("pino interpreter: child logger bindings", () => {
  it("single child merges bindings into effect", async () => {
    const prog = app(($) => $.pino.child({ requestId: "abc" }).info("handling"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].bindings).toEqual([{ requestId: "abc" }]);
    expect(captured[0].msg).toBe("handling");
  });

  it("nested children accumulate bindings in order", async () => {
    const prog = app(($) => $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].bindings).toEqual([{ requestId: "abc" }, { userId: 42 }]);
    expect(captured[0].level).toBe("warn");
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("pino interpreter: input resolution", () => {
  it("resolves input values in merge object", async () => {
    const prog = app({ userId: "number" }, ($) =>
      $.pino.info({ userId: $.input.userId }, "user action"),
    );
    const { captured } = await run(prog, { userId: 456 });
    expect(captured).toHaveLength(1);
    expect(captured[0].mergeObject).toEqual({ userId: 456 });
  });

  it("resolves input values in child bindings", async () => {
    const prog = app({ reqId: "string" }, ($) =>
      $.pino.child({ requestId: $.input.reqId }).info("test"),
    );
    const { captured } = await run(prog, { reqId: "req-789" });
    expect(captured).toHaveLength(1);
    expect(captured[0].bindings).toEqual([{ requestId: "req-789" }]);
  });
});

// ============================================================
// Return value
// ============================================================

describe("pino interpreter: return value", () => {
  it("returns undefined (fire-and-forget)", async () => {
    const prog = app(($) => $.pino.info("test"));
    const { result } = await run(prog);
    expect(result).toBeUndefined();
  });
});
