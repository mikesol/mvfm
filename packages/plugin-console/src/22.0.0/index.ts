// ============================================================
// MVFM PLUGIN: console (Node.js console API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. All 20 console methods supported.
// ============================================================

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
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

const METHOD_NAMES: ReadonlyArray<ConsoleMethodName> = [
  "assert",
  "clear",
  "count",
  "countReset",
  "debug",
  "dir",
  "dirxml",
  "error",
  "group",
  "groupCollapsed",
  "groupEnd",
  "info",
  "log",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "trace",
  "warn",
];

/**
 * Configuration for the console plugin.
 */
export interface ConsoleConfig {
  /** Optional tag for metadata propagation by custom handlers. */
  tag?: string;
}

/** Variadic KindSpec for console methods: unknown[] inputs, void output. */
const variadicKind = {
  inputs: [] as unknown[],
  output: undefined as undefined,
} as KindSpec<unknown[], void>;

function buildKinds(): Record<string, KindSpec<unknown[], void>> {
  const kinds: Record<string, KindSpec<unknown[], void>> = {};
  for (const m of METHOD_NAMES) {
    kinds[`console/${m}`] = variadicKind;
  }
  return kinds;
}

/** Console API exposed on `$.console`. */
export interface ConsoleApi {
  /** Calls `console.assert(condition, ...data)`. */
  assert(condition: unknown, ...data: unknown[]): CExpr<void>;
  /** Calls `console.clear()`. */
  clear(): CExpr<void>;
  /** Calls `console.count(label?)`. */
  count(label?: unknown): CExpr<void>;
  /** Calls `console.countReset(label?)`. */
  countReset(label?: unknown): CExpr<void>;
  /** Calls `console.debug(...data)`. */
  debug(...data: unknown[]): CExpr<void>;
  /** Calls `console.dir(item, options?)`. */
  dir(item?: unknown, options?: unknown): CExpr<void>;
  /** Calls `console.dirxml(...data)`. */
  dirxml(...data: unknown[]): CExpr<void>;
  /** Calls `console.error(...data)`. */
  error(...data: unknown[]): CExpr<void>;
  /** Calls `console.group(...data)`. */
  group(...data: unknown[]): CExpr<void>;
  /** Calls `console.groupCollapsed(...data)`. */
  groupCollapsed(...data: unknown[]): CExpr<void>;
  /** Calls `console.groupEnd()`. */
  groupEnd(): CExpr<void>;
  /** Calls `console.info(...data)`. */
  info(...data: unknown[]): CExpr<void>;
  /** Calls `console.log(...data)`. */
  log(...data: unknown[]): CExpr<void>;
  /** Calls `console.table(tabularData, properties?)`. */
  table(tabularData?: unknown, properties?: unknown): CExpr<void>;
  /** Calls `console.time(label?)`. */
  time(label?: unknown): CExpr<void>;
  /** Calls `console.timeEnd(label?)`. */
  timeEnd(label?: unknown): CExpr<void>;
  /** Calls `console.timeLog(label?, ...data)`. */
  timeLog(label?: unknown, ...data: unknown[]): CExpr<void>;
  /** Calls `console.trace(...data)`. */
  trace(...data: unknown[]): CExpr<void>;
  /** Calls `console.warn(...data)`. */
  warn(...data: unknown[]): CExpr<void>;
}

/**
 * Console operations contributed to the DSL context.
 */
export interface ConsoleMethods {
  /** Console API namespace. */
  console: ConsoleApi;
}

function buildConsoleApi(): ConsoleApi {
  function call(method: ConsoleMethodName, args: unknown[]): CExpr<void> {
    return makeCExpr<void, `console/${typeof method}`, unknown[]>(`console/${method}`, args);
  }

  return {
    assert: (condition, ...data) => call("assert", [condition, ...data]),
    clear: () => call("clear", []),
    count: (label?) => call("count", label === undefined ? [] : [label]),
    countReset: (label?) => call("countReset", label === undefined ? [] : [label]),
    debug: (...data) => call("debug", data),
    dir: (item?, options?) => {
      const args: unknown[] = [];
      if (item !== undefined) args.push(liftConsoleArg(item));
      if (options !== undefined) args.push(liftConsoleArg(options));
      return call("dir", args);
    },
    dirxml: (...data) => call("dirxml", data.map(liftConsoleArg)),
    error: (...data) => call("error", data),
    group: (...data) => call("group", data),
    groupCollapsed: (...data) => call("groupCollapsed", data),
    groupEnd: () => call("groupEnd", []),
    info: (...data) => call("info", data),
    log: (...data) => call("log", data),
    table: (tabularData?, properties?) => {
      const args: unknown[] = [];
      if (tabularData !== undefined) args.push(liftConsoleArg(tabularData));
      if (properties !== undefined) args.push(liftConsoleArg(properties));
      return call("table", args);
    },
    time: (label?) => call("time", label === undefined ? [] : [label]),
    timeEnd: (label?) => call("timeEnd", label === undefined ? [] : [label]),
    timeLog: (label?, ...data) => {
      const args: unknown[] = [];
      if (label !== undefined) args.push(label);
      return call("timeLog", [...args, ...data]);
    },
    trace: (...data) => call("trace", data),
    warn: (...data) => call("warn", data),
  };
}

/**
 * Creates the console plugin definition (unified Plugin type).
 *
 * @param _config - Optional plugin configuration.
 * @returns A unified Plugin that contributes `$.console`.
 */
export function console(_config: ConsoleConfig = {}) {
  const nodeKinds = METHOD_NAMES.map((method) => `console/${method}`);

  return {
    name: "console" as const,
    ctors: { console: buildConsoleApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds,
    defaultInterpreter: (): Interpreter => createConsoleInterpreter(),
  };
}

/**
 * Alias for {@link console}, kept for readability at call sites.
 */
export const consolePlugin = console;
