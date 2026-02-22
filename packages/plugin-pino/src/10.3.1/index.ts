// ============================================================
// MVFM PLUGIN: pino (structured logging) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - Log levels: trace, debug, info, warn, error, fatal
//   - Child loggers with accumulated bindings
//   - Object-only logging (single raw object arg = mergeObject)
//
// Children layout for pino/<level> nodes:
//   [hasMsg(0|1), hasMergeObj(0|1), msg?, mergeObj?, ...bindings]
//
// pino/record nodes (for lifting plain objects):
//   [key0, val0, key1, val1, ...]
// ============================================================

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { createPinoInterpreter } from "./interpreter";

// ---- Constants -----------------------------------------------

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

/** A pino log level name. */
export type PinoLevel = (typeof LEVELS)[number];

// ---- liftArg: recursively lift plain values into CExpr -------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `pino/record` CExprs with key-value child pairs.
 * - Arrays become `pino/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("pino/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("pino/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/**
 * A pino logger interface exposed on the DSL context.
 *
 * Provides six log level methods and `child()` for creating
 * loggers with accumulated bindings. Each method returns
 * `CExpr<void>` for composition via `$.begin()`.
 */
export interface PinoLogger {
  /** Log at trace level. */
  trace(msg: CExpr<string> | string): CExpr<void>;
  trace(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Log at debug level. */
  debug(msg: CExpr<string> | string): CExpr<void>;
  debug(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Log at info level. */
  info(msg: CExpr<string> | string): CExpr<void>;
  info(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Log at warn level. */
  warn(msg: CExpr<string> | string): CExpr<void>;
  warn(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Log at error level. */
  error(msg: CExpr<string> | string): CExpr<void>;
  error(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Log at fatal level. */
  fatal(msg: CExpr<string> | string): CExpr<void>;
  fatal(
    mergeObject: CExpr<Record<string, unknown>> | Record<string, unknown>,
    msg: CExpr<string> | string,
  ): CExpr<void>;
  /** Create a child logger with additional bindings. */
  child(bindings: CExpr<Record<string, unknown>> | Record<string, unknown>): PinoLogger;
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

// ---- Node kinds -------------------------------------------

/** KindSpec for log-level methods: variadic inputs, void output. */
const voidKind: KindSpec<[unknown, ...unknown[]], void> = {
  inputs: [undefined] as unknown as [unknown, ...unknown[]],
  output: undefined as unknown as undefined,
};

const recordKind: KindSpec<unknown[], Record<string, unknown>> = {
  inputs: [] as unknown[],
  output: {} as Record<string, unknown>,
};

const arrayKind: KindSpec<unknown[], unknown[]> = {
  inputs: [] as unknown[],
  output: [] as unknown[],
};

function buildKinds(): Record<string, KindSpec<any, any>> {
  const kinds: Record<string, KindSpec<any, any>> = {};
  for (const level of LEVELS) {
    kinds[`pino/${level}`] = voidKind;
  }
  kinds["pino/record"] = recordKind;
  kinds["pino/array"] = arrayKind;
  return kinds;
}

// ---- Constructor builder ----------------------------------

function buildPinoApi(): PinoLogger {
  function buildLogger(parentBindings: unknown[]): PinoLogger {
    function logMethod(level: PinoLevel) {
      return (...args: unknown[]): CExpr<void> => {
        // Children layout: [hasMsg(0|1), hasMergeObj(0|1), msg?, mergeObj?, ...bindings]
        const children: unknown[] = [];

        if (args.length === 2) {
          // Two args: (mergeObject, msg)
          children.push(1, 1, args[1], liftArg(args[0]));
        } else if (args.length === 1) {
          const arg = args[0];
          if (typeof arg === "object" && arg !== null && !isCExpr(arg)) {
            // Raw object -> mergeObject only
            children.push(0, 1, liftArg(arg));
          } else {
            // String or CExpr -> msg only
            children.push(1, 0, arg);
          }
        } else {
          children.push(0, 0);
        }

        // Append bindings
        children.push(...parentBindings);

        return makeCExpr(`pino/${level}`, children);
      };
    }

    const logger: Record<string, unknown> = {};
    for (const level of LEVELS) {
      logger[level] = logMethod(level);
    }
    logger.child = (
      bindings: CExpr<Record<string, unknown>> | Record<string, unknown>,
    ): PinoLogger => {
      return buildLogger([...parentBindings, liftArg(bindings)]);
    };
    return logger as unknown as PinoLogger;
  }

  return buildLogger([]);
}

// ---- Plugin factory ---------------------------------------

/**
 * Pino plugin factory. Namespace: `pino/`.
 *
 * Creates a plugin that exposes structured logging methods
 * mirroring the real pino API. Log calls produce AST nodes
 * that yield `pino/<level>` effects at interpretation time.
 *
 * @param config - A {@link PinoConfig} with optional level and base bindings.
 * @returns A unified Plugin that contributes `$.pino`.
 */
export function pino(config: PinoConfig = {}) {
  return {
    name: "pino" as const,
    ctors: { pino: buildPinoApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createPinoInterpreter(undefined, config),
  };
}

/**
 * Alias for {@link pino}, kept for readability at call sites.
 */
export const pinoPlugin = pino;
