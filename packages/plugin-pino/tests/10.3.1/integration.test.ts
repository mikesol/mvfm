import { Writable } from "node:stream";
import { coreInterpreter, mvfm, num, str } from "@mvfm/core";
import pinoLib from "pino";
import { describe, expect, it } from "vitest";
import { pino } from "../../src/10.3.1";
import { wrapPino } from "../../src/10.3.1/client-pino";
import { serverEvaluate } from "../../src/10.3.1/handler.server";

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

const baseInterpreter = coreInterpreter;
const app = mvfm(num, str, pino({ level: "trace" }));

function createCapturingLogger() {
  const lines: any[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const logger = pinoLib({ level: "trace" }, dest);
  return { logger, lines };
}

async function run(prog: { ast: any }, logger: any, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = wrapPino(logger);
  const evaluate = serverEvaluate(client, baseInterpreter);
  return await evaluate(ast.result);
}

describe("pino integration: basic logging", () => {
  it("info writes a log line", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app(($) => $.pino.info("hello world"));
    await run(prog, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("hello world");
    expect(lines[0].level).toBe(30); // pino info = 30
  });

  it("info with merge object", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app(($) => $.pino.info({ userId: 123 }, "user action"));
    await run(prog, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("user action");
    expect(lines[0].userId).toBe(123);
  });
});

describe("pino integration: object-only logging", () => {
  it("object-only log writes merge fields without msg", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app(($) => $.pino.info({ userId: 123 }));
    await run(prog, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].userId).toBe(123);
    // pino may or may not include a msg field for object-only calls
    // The key assertion is that userId appears as a top-level field
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
      const prog = app(($) => ($.pino as any)[level]("test"));
      await run(prog, logger);
      expect(lines).toHaveLength(1);
      expect(lines[0].level).toBe(num);
    });
  }
});

describe("pino integration: child loggers", () => {
  it("child bindings appear in log output", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app(($) => $.pino.child({ requestId: "abc" }).info("handling"));
    await run(prog, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].requestId).toBe("abc");
    expect(lines[0].msg).toBe("handling");
  });

  it("nested children accumulate bindings", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app(($) => $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow"));
    await run(prog, logger);
    expect(lines).toHaveLength(1);
    expect(lines[0].requestId).toBe("abc");
    expect(lines[0].userId).toBe(42);
    expect(lines[0].level).toBe(40);
  });
});

describe("pino integration: input resolution", () => {
  it("resolves dynamic input values", async () => {
    const { logger, lines } = createCapturingLogger();
    const prog = app({ userId: "number" }, ($) =>
      $.pino.info({ userId: $.input.userId }, "action"),
    );
    await run(prog, logger, { userId: 789 });
    expect(lines).toHaveLength(1);
    expect(lines[0].userId).toBe(789);
  });
});
