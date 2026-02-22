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
// Children layout for pino/<level> nodes:
//   [hasMsg(0|1), hasMergeObj(0|1), msg?, mergeObj?, ...bindings]
//
// pino/record nodes (for lifting plain objects):
//   [key0, val0, key1, val1, ...]
// ============================================================

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr type params for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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
  trace<A>(msg: A): CExpr<void, "pino/trace", [number, number, A]>;
  trace<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/trace", [number, number, B, A]>;
  /** Log at debug level. */
  debug<A>(msg: A): CExpr<void, "pino/debug", [number, number, A]>;
  debug<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/debug", [number, number, B, A]>;
  /** Log at info level. */
  info<A>(msg: A): CExpr<void, "pino/info", [number, number, A]>;
  info<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/info", [number, number, B, A]>;
  /** Log at warn level. */
  warn<A>(msg: A): CExpr<void, "pino/warn", [number, number, A]>;
  warn<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/warn", [number, number, B, A]>;
  /** Log at error level. */
  error<A>(msg: A): CExpr<void, "pino/error", [number, number, A]>;
  error<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/error", [number, number, B, A]>;
  /** Log at fatal level. */
  fatal<A>(msg: A): CExpr<void, "pino/fatal", [number, number, A]>;
  fatal<A, B>(mergeObject: A, msg: B): CExpr<void, "pino/fatal", [number, number, B, A]>;
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

        return mk(`pino/${level}`, children);
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

// ---- Kind spec helpers ------------------------------------

const voidKind = {
  inputs: [undefined] as unknown as [unknown, ...unknown[]],
  output: undefined as unknown as undefined,
} as KindSpec<[unknown, ...unknown[]], void>;

const recordKind = {
  inputs: [] as unknown[],
  output: {} as Record<string, unknown>,
} as KindSpec<unknown[], Record<string, unknown>>;

const arrayKind = {
  inputs: [] as unknown[],
  output: [] as unknown[],
} as KindSpec<unknown[], unknown[]>;

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
    kinds: {
      "pino/trace": voidKind,
      "pino/debug": voidKind,
      "pino/info": voidKind,
      "pino/warn": voidKind,
      "pino/error": voidKind,
      "pino/fatal": voidKind,
      "pino/record": recordKind,
      "pino/array": arrayKind,
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createPinoInterpreter(undefined, config),
  } satisfies Plugin;
}

/**
 * Alias for {@link pino}, kept for readability at call sites.
 */
export const pinoPlugin = pino;
