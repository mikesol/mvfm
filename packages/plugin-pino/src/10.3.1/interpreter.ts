import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { resolveStructured } from "@mvfm/core";
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
 * Fixed-position children layout for pino/<level> nodes:
 *   [hasMsg(0|1), hasMergeObj(0|1), msg|"", mergeObj|{}, bindingsArray]
 *
 * Positions 3 (mergeObj) and 4 (bindings) are structural —
 * resolved via resolveStructured() at interpretation time.
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
      // Fixed-position children layout:
      //   [hasMsg(0|1), hasMergeObj(0|1), msg|null, mergeObj|null, bindingsArray]
      const hasMsg = (yield 0) as number;
      const hasMergeObj = (yield 1) as number;
      const msg = hasMsg ? ((yield 2) as string) : undefined;
      const mergeObject = hasMergeObj
        ? ((yield* resolveStructured(entry.children[3])) as Record<string, unknown>)
        : undefined;
      const bindingsRaw = (yield* resolveStructured(entry.children[4])) as Record<
        string,
        unknown
      >[];

      await resolvedClient.log(level, bindingsRaw, mergeObject, msg);
      return undefined;
    };
  }

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
