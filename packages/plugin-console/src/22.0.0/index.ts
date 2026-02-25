// ============================================================
// MVFM PLUGIN: console (Node.js console API) — unified Plugin
// ============================================================
//
// Permissive constructors with kind strings so ExtractKinds can
// derive all console/* kinds from the ctor return types.
// ============================================================

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { createConsoleInterpreter } from "./interpreter";

/** Lift plain objects/arrays to structural CExpr nodes so elaborate can process them. */
function liftConsoleArg(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isCExpr(value)) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return makeCExpr("core/tuple", [value]);
  return makeCExpr("core/record", [value]);
}

// liftConsoleArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

/**
 * Full set of Node.js console methods covered by this plugin.
 */
export type ConsoleMethodName =
  | "assert"
  | "clear"
  | "count"
  | "countReset"
  | "debug"
  | "dir"
  | "dirxml"
  | "error"
  | "group"
  | "groupCollapsed"
  | "groupEnd"
  | "info"
  | "log"
  | "table"
  | "time"
  | "timeEnd"
  | "timeLog"
  | "trace"
  | "warn";

/**
 * Configuration for the console plugin.
 */
export interface ConsoleConfig {
  /** Optional tag for metadata propagation by custom handlers. */
  tag?: string;
}

/** Variadic KindSpec for console methods: unknown[] inputs, void output. */
const variadicVoidKind: KindSpec<unknown[], void> = {
  inputs: [] as unknown[],
  output: undefined as unknown as undefined,
};

/** Builds the console constructor methods with permissive generics and kind strings. */
function buildConsoleApi() {
  return {
    /** Calls `console.assert(condition, ...data)`. */
    assert<A, B extends readonly unknown[]>(
      condition: A,
      ...data: B
    ): CExpr<void, "console/assert", [A, ...B]> {
      return mk("console/assert", [condition, ...data]);
    },
    /** Calls `console.clear()`. */
    clear(): CExpr<void, "console/clear", []> {
      return mk("console/clear", []);
    },
    /** Calls `console.count(label?)`. */
    count<A>(...args: [label: A] | []): CExpr<void, "console/count", unknown[]> {
      return mk("console/count", args);
    },
    /** Calls `console.countReset(label?)`. */
    countReset<A>(...args: [label: A] | []): CExpr<void, "console/countReset", unknown[]> {
      return mk("console/countReset", args);
    },
    /** Calls `console.debug(...data)`. */
    debug<A extends readonly unknown[]>(...data: A): CExpr<void, "console/debug", A> {
      return mk("console/debug", data);
    },
    /** Calls `console.dir(item, options?)`. */
    dir<A, B>(
      ...args: [item: A, options: B] | [item: A] | []
    ): CExpr<void, "console/dir", unknown[]> {
      const lifted: unknown[] = [];
      if (args.length > 0) lifted.push(liftConsoleArg(args[0]));
      if (args.length > 1) lifted.push(liftConsoleArg(args[1]));
      return mk("console/dir", lifted);
    },
    /** Calls `console.dirxml(...data)`. */
    dirxml<A extends readonly unknown[]>(...data: A): CExpr<void, "console/dirxml", A> {
      return mk("console/dirxml", data.map(liftConsoleArg));
    },
    /** Calls `console.error(...data)`. */
    error<A extends readonly unknown[]>(...data: A): CExpr<void, "console/error", A> {
      return mk("console/error", data);
    },
    /** Calls `console.group(...data)`. */
    group<A extends readonly unknown[]>(...data: A): CExpr<void, "console/group", A> {
      return mk("console/group", data);
    },
    /** Calls `console.groupCollapsed(...data)`. */
    groupCollapsed<A extends readonly unknown[]>(
      ...data: A
    ): CExpr<void, "console/groupCollapsed", A> {
      return mk("console/groupCollapsed", data);
    },
    /** Calls `console.groupEnd()`. */
    groupEnd(): CExpr<void, "console/groupEnd", []> {
      return mk("console/groupEnd", []);
    },
    /** Calls `console.info(...data)`. */
    info<A extends readonly unknown[]>(...data: A): CExpr<void, "console/info", A> {
      return mk("console/info", data);
    },
    /** Calls `console.log(...data)`. */
    log<A extends readonly unknown[]>(...data: A): CExpr<void, "console/log", A> {
      return mk("console/log", data);
    },
    /** Calls `console.table(tabularData, properties?)`. */
    table<A, B>(
      ...args: [tabularData: A, properties: B] | [tabularData: A] | []
    ): CExpr<void, "console/table", unknown[]> {
      const lifted: unknown[] = [];
      if (args.length > 0) lifted.push(liftConsoleArg(args[0]));
      if (args.length > 1) lifted.push(liftConsoleArg(args[1]));
      return mk("console/table", lifted);
    },
    /** Calls `console.time(label?)`. */
    time<A>(...args: [label: A] | []): CExpr<void, "console/time", unknown[]> {
      return mk("console/time", args);
    },
    /** Calls `console.timeEnd(label?)`. */
    timeEnd<A>(...args: [label: A] | []): CExpr<void, "console/timeEnd", unknown[]> {
      return mk("console/timeEnd", args);
    },
    /** Calls `console.timeLog(label?, ...data)`. */
    timeLog<A, B extends readonly unknown[]>(
      ...args: [label: A, ...data: B] | []
    ): CExpr<void, "console/timeLog", unknown[]> {
      return mk("console/timeLog", [...args]);
    },
    /** Calls `console.trace(...data)`. */
    trace<A extends readonly unknown[]>(...data: A): CExpr<void, "console/trace", A> {
      return mk("console/trace", data);
    },
    /** Calls `console.warn(...data)`. */
    warn<A extends readonly unknown[]>(...data: A): CExpr<void, "console/warn", A> {
      return mk("console/warn", data);
    },
  };
}

/**
 * Console plugin definition (unified Plugin type).
 *
 * Uses `globalThis.console` — no config required.
 */
export const console = {
  name: "console" as const,
  ctors: { console: buildConsoleApi() },
  kinds: {
    "console/assert": variadicVoidKind,
    "console/clear": variadicVoidKind,
    "console/count": variadicVoidKind,
    "console/countReset": variadicVoidKind,
    "console/debug": variadicVoidKind,
    "console/dir": variadicVoidKind,
    "console/dirxml": variadicVoidKind,
    "console/error": variadicVoidKind,
    "console/group": variadicVoidKind,
    "console/groupCollapsed": variadicVoidKind,
    "console/groupEnd": variadicVoidKind,
    "console/info": variadicVoidKind,
    "console/log": variadicVoidKind,
    "console/table": variadicVoidKind,
    "console/time": variadicVoidKind,
    "console/timeEnd": variadicVoidKind,
    "console/timeLog": variadicVoidKind,
    "console/trace": variadicVoidKind,
    "console/warn": variadicVoidKind,
  },
  traits: {},
  lifts: {},
  defaultInterpreter: (): Interpreter => createConsoleInterpreter(),
} satisfies Plugin;

/**
 * Alias for {@link console}, kept for readability at call sites.
 */
export const consolePlugin = console;
