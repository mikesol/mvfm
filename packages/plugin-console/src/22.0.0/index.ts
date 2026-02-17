// ============================================================
// MVFM PLUGIN: console (Node.js console API)
// ============================================================
//
// Implementation status: COMPLETE (all console methods in scope)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - assert, clear, count, countReset, debug, dir, dirxml
//   - error, group, groupCollapsed, groupEnd, info, log
//   - table, time, timeEnd, timeLog, trace, warn
//
// Not doable (fundamental mismatch with AST model):
//   - (none)
//
// Goal: A developer familiar with Node console should write
// Mvfm programs with near-zero learning curve via $.console.*.
//
// Real Node console API:
//   console.log('hello', 1)
//   console.warn('careful')
//   console.assert(ok, 'must be ok')
//   console.time('t'); console.timeLog('t', 'checkpoint'); console.timeEnd('t')
//   console.group('A'); console.groupEnd()
//
// ============================================================

import type { Expr, PluginContext } from "@mvfm/core";
import { definePlugin } from "@mvfm/core";
import { consoleInterpreter } from "./interpreter";

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

type ConsoleArg = Expr<unknown> | unknown;

/**
 * Configuration for the console plugin.
 */
export interface ConsoleConfig {
  /** Optional tag for metadata propagation by custom handlers. */
  tag?: string;
}

/**
 * Console API exposed on `$.console`.
 */
export interface ConsoleApi {
  /** Calls `console.assert(condition, ...data)`. */
  assert(condition: ConsoleArg, ...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.clear()`. */
  clear(): Expr<void>;
  /** Calls `console.count(label?)`. */
  count(label?: ConsoleArg): Expr<void>;
  /** Calls `console.countReset(label?)`. */
  countReset(label?: ConsoleArg): Expr<void>;
  /** Calls `console.debug(...data)`. */
  debug(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.dir(item, options?)`. */
  dir(item?: ConsoleArg, options?: ConsoleArg): Expr<void>;
  /** Calls `console.dirxml(...data)`. */
  dirxml(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.error(...data)`. */
  error(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.group(...data)`. */
  group(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.groupCollapsed(...data)`. */
  groupCollapsed(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.groupEnd()`. */
  groupEnd(): Expr<void>;
  /** Calls `console.info(...data)`. */
  info(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.log(...data)`. */
  log(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.table(tabularData, properties?)`. */
  table(tabularData?: ConsoleArg, properties?: ConsoleArg): Expr<void>;
  /** Calls `console.time(label?)`. */
  time(label?: ConsoleArg): Expr<void>;
  /** Calls `console.timeEnd(label?)`. */
  timeEnd(label?: ConsoleArg): Expr<void>;
  /** Calls `console.timeLog(label?, ...data)`. */
  timeLog(label?: ConsoleArg, ...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.trace(...data)`. */
  trace(...data: ConsoleArg[]): Expr<void>;
  /** Calls `console.warn(...data)`. */
  warn(...data: ConsoleArg[]): Expr<void>;
}

/**
 * Console operations contributed to the DSL context.
 */
export interface ConsoleMethods {
  /** Console API namespace. */
  console: ConsoleApi;
}

function liftMany(ctx: PluginContext, args: ConsoleArg[]): unknown[] {
  return args.map((arg) => ctx.lift(arg).__node);
}

/**
 * Creates the console plugin definition.
 *
 * @param config - Optional plugin configuration.
 * @returns A plugin definition that contributes `$.console`.
 */
export function console(config: ConsoleConfig = {}) {
  const nodeKinds = METHOD_NAMES.map((method) => `console/${method}`);

  return definePlugin({
    name: "console",
    nodeKinds,
    defaultInterpreter: consoleInterpreter,
    build(ctx: PluginContext): ConsoleMethods {
      function call(method: ConsoleMethodName, args: ConsoleArg[]): Expr<void> {
        return ctx.expr<void>({
          kind: `console/${method}`,
          args: liftMany(ctx, args),
          config,
        });
      }

      const api: ConsoleApi = {
        assert(condition: ConsoleArg, ...data: ConsoleArg[]): Expr<void> {
          return call("assert", [condition, ...data]);
        },
        clear(): Expr<void> {
          return call("clear", []);
        },
        count(label?: ConsoleArg): Expr<void> {
          return call("count", label === undefined ? [] : [label]);
        },
        countReset(label?: ConsoleArg): Expr<void> {
          return call("countReset", label === undefined ? [] : [label]);
        },
        debug(...data: ConsoleArg[]): Expr<void> {
          return call("debug", data);
        },
        dir(item?: ConsoleArg, options?: ConsoleArg): Expr<void> {
          const args: ConsoleArg[] = [];
          if (item !== undefined) args.push(item);
          if (options !== undefined) args.push(options);
          return call("dir", args);
        },
        dirxml(...data: ConsoleArg[]): Expr<void> {
          return call("dirxml", data);
        },
        error(...data: ConsoleArg[]): Expr<void> {
          return call("error", data);
        },
        group(...data: ConsoleArg[]): Expr<void> {
          return call("group", data);
        },
        groupCollapsed(...data: ConsoleArg[]): Expr<void> {
          return call("groupCollapsed", data);
        },
        groupEnd(): Expr<void> {
          return call("groupEnd", []);
        },
        info(...data: ConsoleArg[]): Expr<void> {
          return call("info", data);
        },
        log(...data: ConsoleArg[]): Expr<void> {
          return call("log", data);
        },
        table(tabularData?: ConsoleArg, properties?: ConsoleArg): Expr<void> {
          const args: ConsoleArg[] = [];
          if (tabularData !== undefined) args.push(tabularData);
          if (properties !== undefined) args.push(properties);
          return call("table", args);
        },
        time(label?: ConsoleArg): Expr<void> {
          return call("time", label === undefined ? [] : [label]);
        },
        timeEnd(label?: ConsoleArg): Expr<void> {
          return call("timeEnd", label === undefined ? [] : [label]);
        },
        timeLog(label?: ConsoleArg, ...data: ConsoleArg[]): Expr<void> {
          const args: ConsoleArg[] = [];
          if (label !== undefined) args.push(label);
          return call("timeLog", [...args, ...data]);
        },
        trace(...data: ConsoleArg[]): Expr<void> {
          return call("trace", data);
        },
        warn(...data: ConsoleArg[]): Expr<void> {
          return call("warn", data);
        },
      };

      return { console: api };
    },
  });
}

/**
 * Alias for {@link console}, kept for readability at call sites.
 */
export const consolePlugin = console;
