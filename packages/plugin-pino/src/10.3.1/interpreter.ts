import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { wrapPino } from "./client-pino";
import type { PinoConfig, PinoLevel } from "./index";

/**
 * Pino client interface consumed by the pino handler.
 *
 * Abstracts over the actual pino logger so handlers can be
 * tested with mock clients.
 */
export interface PinoClient {
  /** Write a log line at the given level with optional bindings and merge object. */
  log(
    level: string,
    bindings: Record<string, unknown>[],
    mergeObject?: Record<string, unknown>,
    msg?: string,
  ): Promise<void>;
}

const LEVELS: ReadonlyArray<PinoLevel> = ["trace", "debug", "info", "warn", "error", "fatal"];

/**
 * Creates an interpreter for `pino/*` node kinds using the new
 * RuntimeEntry + positional yield pattern.
 *
 * Children layout for pino/<level> nodes:
 *   [hasMsg(0|1), hasMergeObj(0|1), msg?, mergeObj?, ...bindings]
 *
 * Config is captured in the closure, not stored on AST nodes.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @param _config - Plugin config (captured in closure for future use).
 * @returns An Interpreter handling all pino node kinds.
 */
export function createPinoInterpreter(client?: PinoClient, _config: PinoConfig = {}): Interpreter {
  const resolvedClient = client ?? lazyDefaultClient();

  const interp: Interpreter = {};

  for (const level of LEVELS) {
    interp[`pino/${level}`] = async function* (entry: RuntimeEntry) {
      const hasMsg = (yield 0) as number;
      const hasMergeObj = (yield 1) as number;

      let idx = 2;
      const msg = hasMsg ? ((yield idx++) as string) : undefined;
      const mergeObject = hasMergeObj ? ((yield idx++) as Record<string, unknown>) : undefined;

      const bindings: Record<string, unknown>[] = [];
      while (idx < entry.children.length) {
        bindings.push((yield idx++) as Record<string, unknown>);
      }

      await resolvedClient.log(level, bindings, mergeObject, msg);
      return undefined;
    };
  }

  interp["pino/record"] = async function* (entry: RuntimeEntry) {
    // Children are key-value pairs: [key0, val0, key1, val1, ...]
    const result: Record<string, unknown> = {};
    for (let i = 0; i < entry.children.length; i += 2) {
      const key = (yield i) as string;
      const value = yield i + 1;
      result[key] = value;
    }
    return result;
  };

  interp["pino/array"] = async function* (entry: RuntimeEntry) {
    const result: unknown[] = [];
    for (let i = 0; i < entry.children.length; i++) {
      result.push(yield i);
    }
    return result;
  };

  return interp;
}

// ---- Lazy default client (dynamic import of pino) ----------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function lazyDefaultClient(): PinoClient {
  let clientPromise: Promise<PinoClient> | undefined;
  const getClient = async (): Promise<PinoClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("pino").then((moduleValue) => {
        const pinoFactory = moduleValue.default as () => unknown;
        return wrapPino(pinoFactory() as Parameters<typeof wrapPino>[0]);
      });
    }
    return clientPromise;
  };

  return {
    async log(
      level: string,
      bindings: Record<string, unknown>[],
      mergeObject?: Record<string, unknown>,
      msg?: string,
    ): Promise<void> {
      const c = await getClient();
      return c.log(level, bindings, mergeObject, msg);
    },
  } satisfies PinoClient;
}

/**
 * Default pino interpreter that uses a lazily-loaded `pino()` logger.
 */
export const pinoInterpreter: Interpreter = createPinoInterpreter();
