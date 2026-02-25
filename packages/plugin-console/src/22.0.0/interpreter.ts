import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { resolveStructured } from "@mvfm/core";
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

/** Methods whose args are packed into a single structural array. */
const STRUCTURAL_METHODS: ReadonlyArray<ConsoleMethodName> = ["dir", "dirxml", "table"];

/** Methods with normal positional children. */
const POSITIONAL_METHODS: ReadonlyArray<ConsoleMethodName> = [
  "assert",
  "clear",
  "count",
  "countReset",
  "debug",
  "error",
  "group",
  "groupCollapsed",
  "groupEnd",
  "info",
  "log",
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
  for (const method of POSITIONAL_METHODS) {
    interp[`console/${method}`] = async function* (entry: RuntimeEntry) {
      const args: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        args.push(yield i);
      }
      await client.call(method, args);
      return undefined;
    };
  }
  for (const method of STRUCTURAL_METHODS) {
    interp[`console/${method}`] = async function* (entry: RuntimeEntry) {
      const resolved = (yield* resolveStructured(entry.children[0])) as unknown[];
      await client.call(method, resolved);
      return undefined;
    };
  }
  return interp;
}

/**
 * Default console interpreter that uses `globalThis.console`.
 */
export const consoleInterpreter: Interpreter = createConsoleInterpreter();
