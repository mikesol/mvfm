// ============================================================
// ILO PLUGIN: pino (structured logging)
// ============================================================
//
// Implementation status: FULL (all core logging operations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - Log levels: trace, debug, info, warn, error, fatal
//   - Child loggers with accumulated bindings
//   - Object-only logging (single raw object arg = mergeObject)
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
// Goal: An LLM that knows pino should be able to write Ilo
// programs with near-zero learning curve. The API mirrors
// the real pino logger interface.
//
// Real pino API (v10.3.1):
//   const logger = pino({ level: 'info' })
//   logger.info('hello')
//   logger.info({ userId: 123 }, 'user logged in')
//   logger.info({ userId: 123 })  // object-only, no message
//   logger.child({ requestId: 'abc' }).info('handling request')
//
// Based on source-level analysis of pino
// (github.com/pinojs/pino, v10.3.1). The logger instance
// exposes level methods (trace/debug/info/warn/error/fatal)
// that accept optional merge objects and a message string.
// child() returns a new logger with accumulated bindings.
//
// Single-arg heuristic (matching real pino):
//   - raw string → message
//   - raw object → merge object (no message)
//   - Expr → treated as message (use 2-arg form for Expr merge objects)
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
  child(bindings: Expr<Record<string, unknown>> | Record<string, unknown>): PinoLogger;
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
    nodeKinds: ["pino/trace", "pino/debug", "pino/info", "pino/warn", "pino/error", "pino/fatal"],

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
