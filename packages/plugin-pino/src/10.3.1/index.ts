// ============================================================
// MVFM PLUGIN: pino (structured logging) — unified Plugin
// ============================================================
//
// Permissive constructors with inline kinds and kind strings
// in CExpr return types for ExtractKinds compatibility.
//
// Implemented:
//   - Log levels: trace, debug, info, warn, error, fatal
//   - Child loggers with accumulated bindings
//   - Object-only logging (single raw object arg = mergeObject)
//
// Fixed-position children layout for pino/<level> nodes:
//   [hasMsg(0|1), hasMergeObj(0|1), msg|"", mergeObj|{}, bindingsArray]
//
// mergeObj and bindings are Liftable<Record<string, unknown>> —
// resolved at interpretation time via resolveStructured().
// ============================================================

import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

/**
 * Configuration for the pino interpreter.
 */
export interface PinoConfig {
  /** Minimum log level. Defaults to `"info"`. */
  level?: string;
  /** Base bindings merged into every log line. */
  base?: Record<string, unknown>;
}

// ---- Constants -----------------------------------------------

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

/** A pino log level name. */
export type PinoLevel = (typeof LEVELS)[number];

// ---- What the plugin adds to $ ----------------------------

/**
 * A pino logger interface exposed on the DSL context.
 *
 * Provides six log level methods and `child()` for creating
 * loggers with accumulated bindings. Each method returns
 * a CExpr with the appropriate kind string for ExtractKinds.
 */
export interface PinoLogger {
  /** Log at trace level. */
  trace<A>(msg: A): CExpr<void, "pino/trace">;
  trace<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/trace">;
  /** Log at debug level. */
  debug<A>(msg: A): CExpr<void, "pino/debug">;
  debug<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/debug">;
  /** Log at info level. */
  info<A>(msg: A): CExpr<void, "pino/info">;
  info<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/info">;
  /** Log at warn level. */
  warn<A>(msg: A): CExpr<void, "pino/warn">;
  warn<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/warn">;
  /** Log at error level. */
  error<A>(msg: A): CExpr<void, "pino/error">;
  error<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/error">;
  /** Log at fatal level. */
  fatal<A>(msg: A): CExpr<void, "pino/fatal">;
  fatal<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/fatal">;
  /** Create a child logger with additional bindings. */
  child(bindings: Liftable<Record<string, unknown>>): PinoLogger;
}

/**
 * Pino operations added to the DSL context by the pino plugin.
 */
export interface PinoMethods {
  /** Pino structured logger, accessed via `$.pino`. */
  pino: PinoLogger;
}

// ---- Constructor builder ----------------------------------

function buildPinoApi(): PinoLogger {
  function buildLogger(parentBindings: unknown[]): PinoLogger {
    function logMethod(level: PinoLevel) {
      return (...args: unknown[]): CExpr<void> => {
        // Fixed-position children layout:
        //   [hasMsg(0|1), hasMergeObj(0|1), msg|null, mergeObj|null, bindingsArray]
        // Positions 0-2 are normal (lifted by elaborate).
        // Positions 3-4 are structural (resolved via resolveStructured).
        let hasMsg = 0;
        let hasMergeObj = 0;
        let msg: unknown = "";
        let mergeObj: unknown = {};

        if (args.length === 2) {
          // Two args: (mergeObject, msg)
          hasMsg = 1;
          hasMergeObj = 1;
          msg = args[1];
          mergeObj = args[0];
        } else if (args.length === 1) {
          const arg = args[0];
          if (typeof arg === "object" && arg !== null && !isCExpr(arg)) {
            // Raw object -> mergeObject only
            hasMergeObj = 1;
            mergeObj = arg;
          } else {
            // String or CExpr -> msg only
            hasMsg = 1;
            msg = arg;
          }
        }

        return makeCExpr(`pino/${level}`, [
          hasMsg,
          hasMergeObj,
          msg,
          mergeObj,
          parentBindings,
        ]) as CExpr<void>;
      };
    }

    const logger: Record<string, unknown> = {};
    for (const level of LEVELS) {
      logger[level] = logMethod(level);
    }
    logger.child = (bindings: Liftable<Record<string, unknown>>): PinoLogger => {
      return buildLogger([...parentBindings, bindings]);
    };
    return logger as unknown as PinoLogger;
  }

  return buildLogger([]);
}

// ---- Kind spec helpers ------------------------------------

const voidKind = {
  inputs: [undefined] as unknown as [unknown, ...unknown[]],
  output: undefined as unknown as undefined,
} as KindSpec<[unknown, ...unknown[]], void>;

// ---- Plugin definition ------------------------------------

/**
 * The pino plugin definition (unified Plugin type).
 *
 * Contributes `$.pino` with structured logging methods
 * mirroring the real pino API. Log calls produce AST nodes
 * that yield `pino/<level>` effects at interpretation time.
 *
 * Requires an interpreter provided via
 * `defaults(plugins, { pino: createPinoInterpreter(...) })`.
 */
export const pino = {
  name: "pino" as const,
  ctors: { pino: buildPinoApi() },
  kinds: {
    "pino/trace": voidKind,
    "pino/debug": voidKind,
    "pino/info": voidKind,
    "pino/warn": voidKind,
    "pino/error": voidKind,
    "pino/fatal": voidKind,
  },
  shapes: {
    "pino/trace": [null, null, null, "*", "*"],
    "pino/debug": [null, null, null, "*", "*"],
    "pino/info": [null, null, null, "*", "*"],
    "pino/warn": [null, null, null, "*", "*"],
    "pino/error": [null, null, null, "*", "*"],
    "pino/fatal": [null, null, null, "*", "*"],
  },
  traits: {},
  lifts: {},
} satisfies Plugin;

/**
 * Alias for {@link pino}, kept for readability at call sites.
 */
export const pinoPlugin = pino;
