# Pino Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the pino plugin (v10.3.1) for structured logging with 6 level methods and child logger support.

**Architecture:** External-service plugin following the stripe pattern. Uniform effect type `pino/log`. Six node kinds (`pino/trace` through `pino/fatal`). `child()` accumulates bindings on the logger proxy — no separate node kind. Config factory function like stripe.

**Tech Stack:** TypeScript, vitest, pino 10.3.1

**Design doc:** `docs/plans/2026-02-13-pino-plugin-design.md`

**Working directory:** `.worktrees/issue-58/`

---

### Task 1: Plugin Definition — Failing Tests

**Files:**
- Create: `tests/plugins/pino/10.3.1/index.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { pino } from "../../../../src/plugins/pino/10.3.1";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = mvfm(num, str, pino({ level: "info" }));

// ============================================================
// Level methods: info
// ============================================================

describe("pino: info with message only", () => {
  it("produces pino/info node with msg", () => {
    const prog = app(($) => $.pino.info("user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.level).toBe("info");
    expect(ast.result.msg.kind).toBe("core/literal");
    expect(ast.result.msg.value).toBe("user logged in");
    expect(ast.result.mergeObject).toBeNull();
    expect(ast.result.bindings).toEqual([]);
  });
});

describe("pino: info with merge object and message", () => {
  it("produces pino/info node with mergeObject and msg", () => {
    const prog = app(($) => $.pino.info({ userId: 123 }, "user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.kind).toBe("core/record");
    expect(ast.result.mergeObject.fields.userId.value).toBe(123);
    expect(ast.result.msg.value).toBe("user logged in");
  });
});

describe("pino: info with Expr params", () => {
  it("captures proxy dependencies in merge object", () => {
    const prog = app(($) => $.pino.info({ userId: $.input.id }, "user logged in"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.fields.userId.kind).toBe("core/prop_access");
  });
});

// ============================================================
// All six levels
// ============================================================

describe("pino: all six log levels produce correct node kinds", () => {
  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
  for (const level of levels) {
    it(`$.pino.${level}() produces pino/${level} node`, () => {
      const prog = app(($) => ($.pino as any)[level]("test message"));
      const ast = strip(prog.ast) as any;
      expect(ast.result.kind).toBe(`pino/${level}`);
      expect(ast.result.level).toBe(level);
    });
  }
});

// ============================================================
// Child loggers
// ============================================================

describe("pino: child logger", () => {
  it("child bindings are baked into the log node", () => {
    const prog = app(($) => $.pino.child({ requestId: "abc" }).info("handling request"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.bindings).toHaveLength(1);
    expect(ast.result.bindings[0].kind).toBe("core/record");
    expect(ast.result.bindings[0].fields.requestId.value).toBe("abc");
  });

  it("nested child loggers accumulate bindings", () => {
    const prog = app(($) =>
      $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow query"),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/warn");
    expect(ast.result.bindings).toHaveLength(2);
    expect(ast.result.bindings[0].fields.requestId.value).toBe("abc");
    expect(ast.result.bindings[1].fields.userId.value).toBe(42);
  });

  it("child logger accepts Expr bindings", () => {
    const prog = app(($) => $.pino.child({ reqId: $.input.requestId }).info("test"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.bindings[0].fields.reqId.kind).toBe("core/prop_access");
  });
});

// ============================================================
// Object-only logging (no message)
// ============================================================

describe("pino: object-only logging (single raw object arg)", () => {
  it("raw object single arg becomes mergeObject, not msg", () => {
    const prog = app(($) => $.pino.info({ userId: 123 }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.mergeObject.kind).toBe("core/record");
    expect(ast.result.mergeObject.fields.userId.value).toBe(123);
    expect(ast.result.msg).toBeNull();
  });

  it("Expr single arg is treated as msg (use 2-arg form for Expr merge objects)", () => {
    const prog = app(($) => $.pino.info($.input.message));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("pino/info");
    expect(ast.result.msg.kind).toBe("core/prop_access");
    expect(ast.result.mergeObject).toBeNull();
  });
});

// ============================================================
// Integration with $.do()
// ============================================================

describe("pino: integration with $.do()", () => {
  it("log calls composed with $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const logLine = $.pino.info({ action: "login" }, "user logged in");
        return $.do(logLine, $.input.result);
      });
    }).not.toThrow();
  });

  it("orphaned log calls are rejected", () => {
    expect(() => {
      app(($) => {
        $.pino.info("this is orphaned");
        return $.input.result;
      });
    }).toThrow(/unreachable node/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/plugins/pino/10.3.1/index.test.ts`
Expected: FAIL — module `src/plugins/pino/10.3.1` not found

**Step 3: Commit**

```bash
git add tests/plugins/pino/10.3.1/index.test.ts
git commit -m "test: add pino plugin AST construction tests (#58)"
```

---

### Task 2: Plugin Definition — Implementation

**Files:**
- Create: `src/plugins/pino/10.3.1/index.ts`

**Step 1: Write the implementation**

```ts
// ============================================================
// MVFM PLUGIN: pino (structured logging)
// ============================================================
//
// Implementation status: FULL (all core logging operations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - Log levels: trace, debug, info, warn, error, fatal
//   - Child loggers with accumulated bindings
//
// Not doable (fundamental mismatch with AST model):
//   - Transports (runtime stream configuration)
//   - destination() (file descriptor management)
//   - flush() (async stream control)
//   - Redaction (compile-time field transformation)
//   - isLevelEnabled() (runtime level check)
//   - silent level (disables logging entirely — runtime concern)
//
// ============================================================
//
// Goal: An LLM that knows pino should be able to write Mvfm
// programs with near-zero learning curve. The API mirrors
// the real pino logger interface.
//
// Real pino API (v10.3.1):
//   const logger = pino({ level: 'info' })
//   logger.info('hello')
//   logger.info({ userId: 123 }, 'user logged in')
//   logger.child({ requestId: 'abc' }).info('handling request')
//
// Based on source-level analysis of pino
// (github.com/pinojs/pino, v10.3.1). The logger instance
// exposes level methods (trace/debug/info/warn/error/fatal)
// that accept optional merge objects and a message string.
// child() returns a new logger with accumulated bindings.
//
// ============================================================

import type { ASTNode, Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * A pino logger interface exposed on the DSL context.
 *
 * Provides six log level methods and `child()` for creating
 * loggers with accumulated bindings. Each method returns
 * `Expr<void>` for composition via `$.do()`.
 */
export interface PinoLogger {
  /** Log at trace level. */
  trace(msg: Expr<string> | string): Expr<void>;
  trace(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Log at debug level. */
  debug(msg: Expr<string> | string): Expr<void>;
  debug(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Log at info level. */
  info(msg: Expr<string> | string): Expr<void>;
  info(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Log at warn level. */
  warn(msg: Expr<string> | string): Expr<void>;
  warn(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Log at error level. */
  error(msg: Expr<string> | string): Expr<void>;
  error(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Log at fatal level. */
  fatal(msg: Expr<string> | string): Expr<void>;
  fatal(
    mergeObject: Expr<Record<string, unknown>> | Record<string, unknown>,
    msg: Expr<string> | string,
  ): Expr<void>;
  /** Create a child logger with additional bindings. */
  child(
    bindings: Expr<Record<string, unknown>> | Record<string, unknown>,
  ): PinoLogger;
}

/**
 * Pino operations added to the DSL context by the pino plugin.
 */
export interface PinoMethods {
  /** Pino structured logger, accessed via `$.pino`. */
  pino: PinoLogger;
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the pino plugin.
 *
 * @param level - Minimum log level. Defaults to `"info"`.
 * @param base - Base bindings merged into every log line (e.g. pid, hostname).
 */
export interface PinoConfig {
  /** Minimum log level. Defaults to `"info"`. */
  level?: string;
  /** Base bindings merged into every log line. */
  base?: Record<string, unknown>;
}

// ---- Plugin implementation --------------------------------

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

/**
 * Pino plugin factory. Namespace: `pino/`.
 *
 * Creates a plugin that exposes structured logging methods
 * mirroring the real pino API. Log calls produce AST nodes
 * that yield `pino/log` effects at interpretation time.
 *
 * @param config - A {@link PinoConfig} with optional level and base bindings.
 * @returns A {@link PluginDefinition} for the pino plugin.
 */
export function pino(config: PinoConfig = {}): PluginDefinition<PinoMethods> {
  return {
    name: "pino",
    nodeKinds: [
      "pino/trace",
      "pino/debug",
      "pino/info",
      "pino/warn",
      "pino/error",
      "pino/fatal",
    ],

    build(ctx: PluginContext): PinoMethods {
      function buildLogger(parentBindings: ASTNode[]): PinoLogger {
        function logMethod(level: string) {
          return (...args: any[]): Expr<void> => {
            let mergeObject: ASTNode | null = null;
            let msg: ASTNode | null = null;

            if (args.length === 2) {
              // Two args: (mergeObject, msg)
              mergeObject = ctx.lift(args[0]).__node;
              msg = ctx.lift(args[1]).__node;
            } else if (args.length === 1) {
              // Single arg: type heuristic matching real pino behavior
              // - raw string → message
              // - raw object → merge object (no message)
              // - Expr → treated as message (use 2-arg form for Expr merge objects)
              const arg = args[0];
              if (typeof arg === "object" && arg !== null && !ctx.isExpr(arg)) {
                mergeObject = ctx.lift(arg).__node;
              } else {
                msg = ctx.lift(arg).__node;
              }
            }

            return ctx.expr<void>({
              kind: `pino/${level}`,
              level,
              msg,
              mergeObject,
              bindings: parentBindings,
              config,
            });
          };
        }

        const logger: any = {};
        for (const level of LEVELS) {
          logger[level] = logMethod(level);
        }
        logger.child = (
          bindings: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): PinoLogger => {
          return buildLogger([...parentBindings, ctx.lift(bindings).__node]);
        };
        return logger as PinoLogger;
      }

      return {
        pino: buildLogger([]),
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Level methods:
//    Real:  logger.info({ userId: 123 }, 'user logged in')
//    Mvfm:   $.pino.info({ userId: 123 }, 'user logged in')
//    Identical. Only difference is $ prefix.
//
//    Real:  logger.info({ userId: 123 })  // object-only, no msg
//    Mvfm:   $.pino.info({ userId: 123 })  // same — raw object = mergeObject
//
// 2. Child loggers:
//    Real:  logger.child({ requestId: 'abc' }).info('handling')
//    Mvfm:   $.pino.child({ requestId: 'abc' }).info('handling')
//    Namespace is $.pino (consistent with $.stripe, $.postgres).
//    Identical. Bindings accumulate in the AST.
//
// 3. Dynamic values:
//    $.pino.info({ userId: $.input.id }, 'user action')
//    Proxy chains capture dependencies correctly.
//
// DOESN'T WORK / NOT MODELED:
//
// 4. Transports:
//    Real:  pino({ transport: { target: 'pino-pretty' } })
//    Mvfm:   Not modeled. Transports are runtime stream config.
//
// 5. Redaction:
//    Real:  pino({ redact: ['password'] })
//    Mvfm:   Not modeled. Compile-time field transformation.
//
// 6. Level filtering:
//    Real:  logger.isLevelEnabled('debug')
//    Mvfm:   Not modeled. Level filtering is a runtime concern
//           handled by the handler, not the AST.
//
// 7. Serializers:
//    Real:  pino({ serializers: { err: pino.stdSerializers.err } })
//    Mvfm:   Not modeled. Serializers transform objects at write
//           time — a handler concern.
//
// ============================================================
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- tests/plugins/pino/10.3.1/index.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/plugins/pino/10.3.1/index.ts
git commit -m "feat: add pino plugin definition with 6 log levels and child loggers (#58)"
```

---

### Task 3: Interpreter — Failing Tests

**Files:**
- Create: `tests/plugins/pino/10.3.1/interpreter.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { foldAST, mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { pino } from "../../../../src/plugins/pino/10.3.1";
import { pinoInterpreter } from "../../../../src/plugins/pino/10.3.1/interpreter";

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
    const prog = app(($) =>
      $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow"),
    );
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
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/plugins/pino/10.3.1/interpreter.test.ts`
Expected: FAIL — module `src/plugins/pino/10.3.1/interpreter` not found

**Step 3: Commit**

```bash
git add tests/plugins/pino/10.3.1/interpreter.test.ts
git commit -m "test: add pino interpreter effect-yielding tests (#58)"
```

---

### Task 4: Interpreter — Implementation

**Files:**
- Create: `src/plugins/pino/10.3.1/interpreter.ts`

**Step 1: Write the implementation**

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Pino client interface consumed by the pino handler.
 *
 * Abstracts over the actual pino logger so handlers can be
 * tested with mock clients.
 */
export interface PinoClient {
  /** Write a log line at the given level with optional bindings and merge object. */
  log(
    level: string,
    bindings: Record<string, unknown>[],
    mergeObject?: Record<string, unknown>,
    msg?: string,
  ): Promise<void>;
}

/**
 * Generator-based interpreter fragment for pino plugin nodes.
 *
 * Yields `pino/log` effects for all 6 log levels. Each effect
 * contains the level, resolved bindings chain, optional merge
 * object, and optional message string.
 */
export const pinoInterpreter: InterpreterFragment = {
  pluginName: "pino",
  canHandle: (node) => node.kind.startsWith("pino/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    // All 6 levels follow the same pattern
    const msg =
      node.msg != null
        ? ((yield { type: "recurse", child: node.msg as ASTNode }) as string)
        : undefined;

    const mergeObject =
      node.mergeObject != null
        ? ((yield {
            type: "recurse",
            child: node.mergeObject as ASTNode,
          }) as Record<string, unknown>)
        : undefined;

    const bindingNodes = node.bindings as ASTNode[];
    const bindings: Record<string, unknown>[] = [];
    for (const b of bindingNodes) {
      bindings.push(
        (yield { type: "recurse", child: b }) as Record<string, unknown>,
      );
    }

    return yield {
      type: "pino/log",
      level: node.level as string,
      ...(msg !== undefined ? { msg } : {}),
      ...(mergeObject !== undefined ? { mergeObject } : {}),
      bindings,
    };
  },
};
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- tests/plugins/pino/10.3.1/interpreter.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/plugins/pino/10.3.1/interpreter.ts
git commit -m "feat: add pino interpreter with uniform pino/log effect (#58)"
```

---

### Task 5: Server Handler and SDK Adapter

**Files:**
- Create: `src/plugins/pino/10.3.1/handler.server.ts`
- Create: `src/plugins/pino/10.3.1/client-pino.ts`

**Step 1: Write handler.server.ts**

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { PinoClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes pino effects
 * against a real pino client.
 *
 * Handles `pino/log` effects by delegating to
 * `client.log(level, bindings, mergeObject, msg)`.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: PinoClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "pino/log") {
      const { level, bindings, mergeObject, msg } = effect as {
        type: "pino/log";
        level: string;
        bindings: Record<string, unknown>[];
        mergeObject?: Record<string, unknown>;
        msg?: string;
      };
      await client.log(level, bindings, mergeObject, msg);
      return { value: undefined, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a pino client using the provided interpreter fragments.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: PinoClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Write client-pino.ts**

```ts
import type { PinoClient } from "./interpreter";

/**
 * Pino logger interface expected by the SDK adapter.
 *
 * This matches the subset of the real pino API that we use:
 * level methods and child().
 */
export interface PinoInstance {
  trace(obj: Record<string, unknown>, msg?: string): void;
  trace(msg: string): void;
  debug(obj: Record<string, unknown>, msg?: string): void;
  debug(msg: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  info(msg: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  warn(msg: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  error(msg: string): void;
  fatal(obj: Record<string, unknown>, msg?: string): void;
  fatal(msg: string): void;
  child(bindings: Record<string, unknown>): PinoInstance;
}

/**
 * Wraps a real pino logger instance into a {@link PinoClient}.
 *
 * Reconstructs the child logger chain from the bindings array,
 * then calls the appropriate level method.
 *
 * @param logger - A configured pino logger instance.
 * @returns A {@link PinoClient} adapter.
 */
export function wrapPino(logger: PinoInstance): PinoClient {
  return {
    async log(
      level: string,
      bindings: Record<string, unknown>[],
      mergeObject?: Record<string, unknown>,
      msg?: string,
    ): Promise<void> {
      // Build the child logger chain
      let current: PinoInstance = logger;
      for (const b of bindings) {
        current = current.child(b);
      }

      // Call the level method
      const logFn = (current as any)[level] as Function;
      if (!logFn) {
        throw new Error(`wrapPino: unknown log level "${level}"`);
      }

      if (mergeObject !== undefined && msg !== undefined) {
        logFn.call(current, mergeObject, msg);
      } else if (msg !== undefined) {
        logFn.call(current, msg);
      } else if (mergeObject !== undefined) {
        logFn.call(current, mergeObject);
      }
    },
  };
}
```

**Step 3: Run full test suite to verify nothing broke**

Run: `npm test -- tests/plugins/pino/`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/plugins/pino/10.3.1/handler.server.ts src/plugins/pino/10.3.1/client-pino.ts
git commit -m "feat: add pino server handler and SDK adapter (#58)"
```

---

### Task 6: Client Handler

**Files:**
- Create: `src/plugins/pino/10.3.1/handler.client.ts`

**Step 1: Write the implementation**

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends pino effects as JSON
 * to a remote server endpoint for execution.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/mvfm/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 2: Run full test suite**

Run: `npm test -- tests/plugins/pino/`
Expected: All tests still PASS

**Step 3: Commit**

```bash
git add src/plugins/pino/10.3.1/handler.client.ts
git commit -m "feat: add pino client handler for HTTP proxy (#58)"
```

---

### Task 7: Integration Tests

**Files:**
- Create: `tests/plugins/pino/10.3.1/integration.test.ts`

**Step 1: Write the integration tests**

These test against a real pino instance (no container needed — pino is a pure JS logger).

```ts
import pinoLib from "pino";
import { describe, expect, it } from "vitest";
import { mvfm } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { pino } from "../../../../src/plugins/pino/10.3.1";
import { wrapPino } from "../../../../src/plugins/pino/10.3.1/client-pino";
import { serverEvaluate } from "../../../../src/plugins/pino/10.3.1/handler.server";
import { pinoInterpreter } from "../../../../src/plugins/pino/10.3.1/interpreter";

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

const allFragments = [pinoInterpreter, coreInterpreter];
const app = mvfm(num, str, pino({ level: "trace" }));

// Capture log output by writing to a custom destination
function createCapturingLogger() {
  const lines: any[] = [];
  const dest = new (require("stream").Writable)({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const logger = pinoLib({ level: "trace" }, dest);
  return { logger, lines };
}

async function run(
  prog: { ast: any },
  logger: any,
  input: Record<string, unknown> = {},
) {
  const ast = injectInput(prog.ast, input);
  const client = wrapPino(logger);
  const evaluate = serverEvaluate(client, allFragments);
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
    expect(lines[0].msg).toBeUndefined();
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
    const prog = app(($) =>
      $.pino.child({ requestId: "abc" }).child({ userId: 42 }).warn("slow"),
    );
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
```

**Step 2: Install pino as a dev dependency**

Run: `npm install --save-dev pino`

**Step 3: Run integration tests**

Run: `npm test -- tests/plugins/pino/10.3.1/integration.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/plugins/pino/10.3.1/integration.test.ts package.json package-lock.json
git commit -m "test: add pino integration tests with real pino instance (#58)"
```

---

### Task 8: Public Exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Add pino exports**

Add the following exports to `src/index.ts`, following the stripe/postgres pattern with aliased names to avoid collisions:

```ts
// ---- pino ----
export type { PinoConfig, PinoLogger, PinoMethods } from "./plugins/pino/10.3.1";
export { pino } from "./plugins/pino/10.3.1";
export { wrapPino } from "./plugins/pino/10.3.1/client-pino";
export type {
  ClientHandlerOptions as PinoClientHandlerOptions,
  ClientHandlerState as PinoClientHandlerState,
} from "./plugins/pino/10.3.1/handler.client";
export { clientHandler as pinoClientHandler } from "./plugins/pino/10.3.1/handler.client";
export {
  serverEvaluate as pinoServerEvaluate,
  serverHandler as pinoServerHandler,
} from "./plugins/pino/10.3.1/handler.server";
export type { PinoClient } from "./plugins/pino/10.3.1/interpreter";
export { pinoInterpreter } from "./plugins/pino/10.3.1/interpreter";
```

**Step 2: Run build and type check**

Run: `npm run build && npm run check`
Expected: No errors

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS (438 existing + new pino tests)

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add pino plugin public exports (#58)"
```

---

### Task 9: Final Validation

**Step 1: Full build + check + test**

Run: `npm run build && npm run check && npm test`
Expected: All pass, no type errors, no test failures

**Step 2: Verify all files exist**

Confirm these files exist:
- `src/plugins/pino/10.3.1/index.ts`
- `src/plugins/pino/10.3.1/interpreter.ts`
- `src/plugins/pino/10.3.1/handler.server.ts`
- `src/plugins/pino/10.3.1/handler.client.ts`
- `src/plugins/pino/10.3.1/client-pino.ts`
- `tests/plugins/pino/10.3.1/index.test.ts`
- `tests/plugins/pino/10.3.1/interpreter.test.ts`
- `tests/plugins/pino/10.3.1/integration.test.ts`

**Step 3: Create PR**

```bash
gh pr create --title "feat: pino plugin for structured logging (#58)" --body "$(cat <<'EOF'
## Summary
- Implements pino plugin (v10.3.1) for structured logging
- 6 log level methods: trace, debug, info, warn, error, fatal
- Child logger support with accumulated bindings
- Uniform `pino/log` effect type, server/client handlers, SDK adapter

Closes #58

## Design alignment
- Follows plugin-authoring-guide.md: three required fields, namespaced node kinds, ctx.expr() pattern
- External-service plugin structure: versioned directory, interpreter, handlers, SDK adapter
- Source-level analysis documented in index.ts header

## Validation performed
- `npm run build` — no type errors
- `npm run check` — lint clean
- `npm test` — all tests pass (existing + new pino tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
