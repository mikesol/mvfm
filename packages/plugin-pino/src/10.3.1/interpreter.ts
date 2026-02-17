import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_, typedInterpreter } from "@mvfm/core";
import { wrapPino } from "./client-pino";

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

interface PinoNode<K extends string> extends TypedNode<void> {
  kind: K;
  level: string;
  msg?: TypedNode<string>;
  mergeObject?: TypedNode<Record<string, unknown>>;
  bindings: TypedNode<Record<string, unknown>>[];
}

interface PinoTraceNode extends PinoNode<"pino/trace"> {
  level: "trace";
}
interface PinoDebugNode extends PinoNode<"pino/debug"> {
  level: "debug";
}
interface PinoInfoNode extends PinoNode<"pino/info"> {
  level: "info";
}
interface PinoWarnNode extends PinoNode<"pino/warn"> {
  level: "warn";
}
interface PinoErrorNode extends PinoNode<"pino/error"> {
  level: "error";
}
interface PinoFatalNode extends PinoNode<"pino/fatal"> {
  level: "fatal";
}

type PinoAnyNode =
  | PinoTraceNode
  | PinoDebugNode
  | PinoInfoNode
  | PinoWarnNode
  | PinoErrorNode
  | PinoFatalNode;

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "pino/trace": PinoTraceNode;
    "pino/debug": PinoDebugNode;
    "pino/info": PinoInfoNode;
    "pino/warn": PinoWarnNode;
    "pino/error": PinoErrorNode;
    "pino/fatal": PinoFatalNode;
  }
}

/**
 * Creates an interpreter for `pino/*` node kinds.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @returns An Interpreter handling all pino node kinds.
 */
export function createPinoInterpreter(client: PinoClient): Interpreter {
  const handler = async function* (node: PinoAnyNode) {
    const msg = node.msg != null ? yield* eval_(node.msg) : undefined;
    const mergeObject = node.mergeObject != null ? yield* eval_(node.mergeObject) : undefined;
    const bindings: Record<string, unknown>[] = [];
    for (const b of node.bindings) {
      bindings.push(yield* eval_(b));
    }
    await client.log(node.level, bindings, mergeObject, msg);
    return undefined;
  };

  return typedInterpreter<
    "pino/trace" | "pino/debug" | "pino/info" | "pino/warn" | "pino/error" | "pino/fatal"
  >()({
    "pino/trace": handler,
    "pino/debug": handler,
    "pino/info": handler,
    "pino/warn": handler,
    "pino/error": handler,
    "pino/fatal": handler,
  });
}

const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<any>;

function lazyInterpreter(factory: () => Interpreter): Interpreter {
  let cached: Interpreter | undefined;
  const get = () => (cached ??= factory());
  return new Proxy({} as Interpreter, {
    get(_target, property) {
      return get()[property as keyof Interpreter];
    },
    has(_target, property) {
      return property in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(get(), property);
      return descriptor
        ? descriptor
        : { configurable: true, enumerable: true, writable: false, value: undefined };
    },
  });
}

/**
 * Default pino interpreter that uses a default `pino()` logger.
 */
export const pinoInterpreter: Interpreter = lazyInterpreter(() =>
  createPinoInterpreter(
    (() => {
      let clientPromise: Promise<PinoClient> | undefined;
      const getClient = async (): Promise<PinoClient> => {
        if (!clientPromise) {
          clientPromise = dynamicImport("pino").then((moduleValue) => {
            const pino = moduleValue.default as () => unknown;
            return wrapPino(pino() as any);
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
          const client = await getClient();
          return client.log(level, bindings, mergeObject, msg);
        },
      } satisfies PinoClient;
    })(),
  ),
);
