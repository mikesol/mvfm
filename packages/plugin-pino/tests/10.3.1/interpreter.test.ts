import { boolPluginU, createApp, defaults, fold, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { pinoInterpreter } from "../../src";
import { pino } from "../../src/10.3.1";
import { createPinoInterpreter, type PinoClient } from "../../src/10.3.1/interpreter";

const plugin = pino({ level: "info" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

async function run(expr: unknown) {
  const captured: Array<{
    level: string;
    bindings: Record<string, unknown>[];
    mergeObject?: Record<string, unknown>;
    msg?: string;
  }> = [];
  const mockClient: PinoClient = {
    async log(level, bindings, mergeObject, msg) {
      captured.push({ level, bindings, mergeObject, msg });
    },
  };
  const nexpr = app(expr as any);
  const interp = defaults(plugins, {
    pino: createPinoInterpreter(mockClient),
  });
  const result = await fold(nexpr, interp);
  return { result, captured };
}

// ============================================================
// Info
// ============================================================

describe("pino interpreter: info with message", () => {
  it("exports a default ready-to-use interpreter", () => {
    expect(typeof pinoInterpreter["pino/info"]).toBe("function");
  });

  it("calls client.log with level info", async () => {
    const expr = $.pino.info("hello world");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("info");
    expect(captured[0].msg).toBe("hello world");
    expect(captured[0].mergeObject).toBeUndefined();
    expect(captured[0].bindings).toEqual([]);
  });
});

describe("pino interpreter: info with merge object and message", () => {
  it("calls client.log with mergeObject", async () => {
    const expr = $.pino.info({ userId: 123 }, "user action");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].level).toBe("info");
    expect(captured[0].msg).toBe("user action");
    expect(captured[0].mergeObject).toEqual({ userId: 123 });
  });
});

// ============================================================
// Object-only logging
// ============================================================

describe("pino interpreter: object-only logging", () => {
  it("calls client.log with mergeObject and no msg", async () => {
    const expr = $.pino.info({ userId: 123 });
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
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
    it(`${level} calls client.log with level="${level}"`, async () => {
      const expr = ($.pino as any)[level]("test");
      const { captured } = await run(expr);
      expect(captured).toHaveLength(1);
      expect(captured[0].level).toBe(level);
      expect(captured[0].msg).toBe("test");
    });
  }
});

// ============================================================
// Child loggers
// ============================================================

describe("pino interpreter: child logger bindings", () => {
  it("single child merges bindings into call", async () => {
    const expr = $.pino.child({ requestId: "abc" }).info("handling");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].bindings).toEqual([{ requestId: "abc" }]);
    expect(captured[0].msg).toBe("handling");
  });

  it("nested children accumulate bindings in order", async () => {
    const expr = $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow");
    const { captured } = await run(expr);
    expect(captured).toHaveLength(1);
    expect(captured[0].bindings).toEqual([{ requestId: "abc" }, { userId: 42 }]);
    expect(captured[0].level).toBe("warn");
  });
});

// ============================================================
// Return value
// ============================================================

describe("pino interpreter: return value", () => {
  it("returns undefined (fire-and-forget)", async () => {
    const expr = $.pino.info("test");
    const { result } = await run(expr);
    expect(result).toBeUndefined();
  });
});
