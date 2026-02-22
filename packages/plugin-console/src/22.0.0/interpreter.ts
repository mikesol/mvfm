import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { type ConsoleInstance, wrapConsole } from "./client-console";
import type { ConsoleMethodName } from "./index";

/**
 * Console client interface consumed by server handlers.
 */
export interface ConsoleClient {
  /**
   * Executes a console method call.
   *
   * @param method - Console method name.
   * @param args - Resolved argument values.
   * @returns A promise that resolves when the call completes.
   */
  call(method: ConsoleMethodName, args: unknown[]): Promise<void>;
}

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
 * Creates an interpreter for `console/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * @param client - Console effect execution client (defaults to globalThis.console).
 * @returns An Interpreter handling all console node kinds.
 */
export function createConsoleInterpreter(
  client: ConsoleClient = wrapConsole(globalThis.console as unknown as ConsoleInstance),
): Interpreter {
  const interp: Interpreter = {};
  for (const method of METHOD_NAMES) {
    interp[`console/${method}`] = async function* (entry: RuntimeEntry) {
      const args: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        args.push(yield i);
      }
      await client.call(method, args);
      return undefined;
    };
  }
  return interp;
}

/**
 * Default console interpreter that uses `globalThis.console`.
 */
export const consoleInterpreter: Interpreter = createConsoleInterpreter();
