import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface PinoNode extends TypedNode<void> {
  kind: string;
  level: string;
  msg?: TypedNode<string>;
  mergeObject?: TypedNode<Record<string, unknown>>;
  bindings: TypedNode<Record<string, unknown>>[];
}

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

/**
 * Creates an interpreter for `pino/*` node kinds.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @returns An Interpreter handling all pino node kinds.
 */
export function createPinoInterpreter(client: PinoClient): Interpreter {
  const handler = async function* (node: PinoNode) {
    const msg = node.msg != null ? yield* eval_(node.msg) : undefined;
    const mergeObject = node.mergeObject != null ? yield* eval_(node.mergeObject) : undefined;
    const bindings: Record<string, unknown>[] = [];
    for (const b of node.bindings) {
      bindings.push(yield* eval_(b));
    }
    await client.log(node.level, bindings, mergeObject, msg);
    return undefined;
  };

  return Object.fromEntries(LEVELS.map((l) => [`pino/${l}`, handler]));
}
