import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";
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

interface ConsoleMethodNode extends TypedNode<void> {
  kind: string;
  args: TypedNode[];
}

const METHODS: readonly ConsoleMethodName[] = [
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
 * Creates an interpreter for `console/*` node kinds.
 *
 * @param client - Console effect execution client.
 * @returns An Interpreter handling all console node kinds.
 */
export function createConsoleInterpreter(client: ConsoleClient): Interpreter {
  const handler = async function* (node: ConsoleMethodNode) {
    const method = node.kind.slice("console/".length) as ConsoleMethodName;
    const args: unknown[] = [];
    for (const argNode of node.args ?? []) {
      args.push(yield* eval_(argNode));
    }
    await client.call(method, args);
    return undefined;
  };

  return Object.fromEntries(METHODS.map((m) => [`console/${m}`, handler]));
}
