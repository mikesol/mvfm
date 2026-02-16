import type { ConsoleMethodName } from "./index";
import type { ConsoleClient } from "./interpreter";

/**
 * Console-like runtime instance consumed by the adapter.
 */
export interface ConsoleInstance {
  /** Console assertion method. */
  assert: (...args: unknown[]) => void;
  /** Console clear method. */
  clear: (...args: unknown[]) => void;
  /** Console count method. */
  count: (...args: unknown[]) => void;
  /** Console countReset method. */
  countReset: (...args: unknown[]) => void;
  /** Console debug method. */
  debug: (...args: unknown[]) => void;
  /** Console dir method. */
  dir: (...args: unknown[]) => void;
  /** Console dirxml method. */
  dirxml: (...args: unknown[]) => void;
  /** Console error method. */
  error: (...args: unknown[]) => void;
  /** Console group method. */
  group: (...args: unknown[]) => void;
  /** Console groupCollapsed method. */
  groupCollapsed: (...args: unknown[]) => void;
  /** Console groupEnd method. */
  groupEnd: (...args: unknown[]) => void;
  /** Console info method. */
  info: (...args: unknown[]) => void;
  /** Console log method. */
  log: (...args: unknown[]) => void;
  /** Console table method. */
  table: (...args: unknown[]) => void;
  /** Console time method. */
  time: (...args: unknown[]) => void;
  /** Console timeEnd method. */
  timeEnd: (...args: unknown[]) => void;
  /** Console timeLog method. */
  timeLog: (...args: unknown[]) => void;
  /** Console trace method. */
  trace: (...args: unknown[]) => void;
  /** Console warn method. */
  warn: (...args: unknown[]) => void;
}

/**
 * Wraps a console-like instance into a {@link ConsoleClient}.
 *
 * @param instance - Target console-like object.
 * @returns Console client adapter.
 */
export function wrapConsole(instance: ConsoleInstance): ConsoleClient {
  return {
    async call(method: ConsoleMethodName, args: unknown[]): Promise<void> {
      const fn = instance[method];
      if (typeof fn !== "function") {
        throw new Error(`wrapConsole: unsupported console method "${method}"`);
      }
      fn(...args);
    },
  };
}
