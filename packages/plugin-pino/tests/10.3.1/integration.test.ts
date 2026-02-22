import { Writable } from "node:stream";
import { boolPluginU, createApp, defaults, mvfmU, numPluginU, strPluginU } from "@mvfm/core";
import pinoLib from "pino";
import { describe, expect, it } from "vitest";
import { pino } from "../../src/10.3.1";
import { wrapPino } from "../../src/10.3.1/client-pino";
import { serverEvaluate } from "../../src/10.3.1/handler.server";

const plugin = pino({ level: "trace" });
const plugins = [numPluginU, strPluginU, boolPluginU, plugin] as const;
const $ = mvfmU(...plugins);
const app = createApp(...plugins);

function createCapturingLogger() {
  const lines: Record<string, unknown>[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const logger = pinoLib({ level: "trace" }, dest);
  return { logger, lines };
}

async function run(expr: unknown, logger: unknown) {
  const nexpr = app(expr as any);
  const client = wrapPino(logger as Parameters<typeof wrapPino>[0]);
  const baseInterp = defaults(plugins);
  const evaluate = serverEvaluate(client, baseInterp);
  return await evaluate(nexpr);
}

describe("pino integration: basic logging", () => {
  it("info writes a log line", async () => {
    const { logger, lines } = createCapturingLogger();
    const expr = $.pino.info("hello world");
    await run(expr, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("hello world");
    expect(lines[0].level).toBe(30); // pino info = 30
  });

  it("info with merge object", async () => {
    const { logger, lines } = createCapturingLogger();
    const expr = $.pino.info({ userId: 123 }, "user action");
    await run(expr, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("user action");
    expect(lines[0].userId).toBe(123);
  });
});

describe("pino integration: object-only logging", () => {
  it("object-only log writes merge fields without msg", async () => {
    const { logger, lines } = createCapturingLogger();
    const expr = $.pino.info({ userId: 123 });
    await run(expr, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].userId).toBe(123);
  });
});

describe("pino integration: all levels", () => {
  const levelMap: Record<string, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  };

  for (const [level, num] of Object.entries(levelMap)) {
    it(`${level} writes at level ${num}`, async () => {
      const { logger, lines } = createCapturingLogger();
      const expr = ($.pino as any)[level]("test");
      await run(expr, logger);
      expect(lines).toHaveLength(1);
      expect(lines[0].level).toBe(num);
    });
  }
});

describe("pino integration: child loggers", () => {
  it("child bindings appear in log output", async () => {
    const { logger, lines } = createCapturingLogger();
    const expr = $.pino.child({ requestId: "abc" }).info("handling");
    await run(expr, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].requestId).toBe("abc");
    expect(lines[0].msg).toBe("handling");
  });

  it("nested children accumulate bindings", async () => {
    const { logger, lines } = createCapturingLogger();
    const expr = $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow");
    await run(expr, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].requestId).toBe("abc");
    expect(lines[0].userId).toBe(42);
    expect(lines[0].level).toBe(40);
  });
});
