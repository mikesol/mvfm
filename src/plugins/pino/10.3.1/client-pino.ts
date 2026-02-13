import type { PinoClient } from "./interpreter";

/**
 * Pino logger interface expected by the SDK adapter.
 *
 * This matches the subset of the real pino API that we use:
 * level methods and child().
 */
export interface PinoInstance {
  trace(obj: Record<string, unknown>, msg?: string): void;
  trace(msg: string): void;
  debug(obj: Record<string, unknown>, msg?: string): void;
  debug(msg: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  info(msg: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  warn(msg: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  error(msg: string): void;
  fatal(obj: Record<string, unknown>, msg?: string): void;
  fatal(msg: string): void;
  child(bindings: Record<string, unknown>): PinoInstance;
}

/**
 * Wraps a real pino logger instance into a {@link PinoClient}.
 *
 * Reconstructs the child logger chain from the bindings array,
 * then calls the appropriate level method.
 *
 * @param logger - A configured pino logger instance.
 * @returns A {@link PinoClient} adapter.
 */
export function wrapPino(logger: PinoInstance): PinoClient {
  return {
    async log(
      level: string,
      bindings: Record<string, unknown>[],
      mergeObject?: Record<string, unknown>,
      msg?: string,
    ): Promise<void> {
      // Build the child logger chain
      let current: PinoInstance = logger;
      for (const b of bindings) {
        current = current.child(b);
      }

      // Call the level method
      const logFn = (current as any)[level] as Function;
      if (!logFn) {
        throw new Error(`wrapPino: unknown log level "${level}"`);
      }

      if (mergeObject !== undefined && msg !== undefined) {
        logFn.call(current, mergeObject, msg);
      } else if (msg !== undefined) {
        logFn.call(current, msg);
      } else if (mergeObject !== undefined) {
        logFn.call(current, mergeObject);
      }
    },
  };
}
