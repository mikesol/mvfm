import type { Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";
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

interface ConsoleMethodNode<K extends string> extends TypedNode<void> {
  kind: K;
  args: TypedNode[];
}

interface ConsoleAssertNode extends ConsoleMethodNode<"console/assert"> {}
interface ConsoleClearNode extends ConsoleMethodNode<"console/clear"> {}
interface ConsoleCountNode extends ConsoleMethodNode<"console/count"> {}
interface ConsoleCountResetNode extends ConsoleMethodNode<"console/countReset"> {}
interface ConsoleDebugNode extends ConsoleMethodNode<"console/debug"> {}
interface ConsoleDirNode extends ConsoleMethodNode<"console/dir"> {}
interface ConsoleDirxmlNode extends ConsoleMethodNode<"console/dirxml"> {}
interface ConsoleErrorNode extends ConsoleMethodNode<"console/error"> {}
interface ConsoleGroupNode extends ConsoleMethodNode<"console/group"> {}
interface ConsoleGroupCollapsedNode extends ConsoleMethodNode<"console/groupCollapsed"> {}
interface ConsoleGroupEndNode extends ConsoleMethodNode<"console/groupEnd"> {}
interface ConsoleInfoNode extends ConsoleMethodNode<"console/info"> {}
interface ConsoleLogNode extends ConsoleMethodNode<"console/log"> {}
interface ConsoleTableNode extends ConsoleMethodNode<"console/table"> {}
interface ConsoleTimeNode extends ConsoleMethodNode<"console/time"> {}
interface ConsoleTimeEndNode extends ConsoleMethodNode<"console/timeEnd"> {}
interface ConsoleTimeLogNode extends ConsoleMethodNode<"console/timeLog"> {}
interface ConsoleTraceNode extends ConsoleMethodNode<"console/trace"> {}
interface ConsoleWarnNode extends ConsoleMethodNode<"console/warn"> {}

type ConsoleAnyNode =
  | ConsoleAssertNode
  | ConsoleClearNode
  | ConsoleCountNode
  | ConsoleCountResetNode
  | ConsoleDebugNode
  | ConsoleDirNode
  | ConsoleDirxmlNode
  | ConsoleErrorNode
  | ConsoleGroupNode
  | ConsoleGroupCollapsedNode
  | ConsoleGroupEndNode
  | ConsoleInfoNode
  | ConsoleLogNode
  | ConsoleTableNode
  | ConsoleTimeNode
  | ConsoleTimeEndNode
  | ConsoleTimeLogNode
  | ConsoleTraceNode
  | ConsoleWarnNode;

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "console/assert": ConsoleAssertNode;
    "console/clear": ConsoleClearNode;
    "console/count": ConsoleCountNode;
    "console/countReset": ConsoleCountResetNode;
    "console/debug": ConsoleDebugNode;
    "console/dir": ConsoleDirNode;
    "console/dirxml": ConsoleDirxmlNode;
    "console/error": ConsoleErrorNode;
    "console/group": ConsoleGroupNode;
    "console/groupCollapsed": ConsoleGroupCollapsedNode;
    "console/groupEnd": ConsoleGroupEndNode;
    "console/info": ConsoleInfoNode;
    "console/log": ConsoleLogNode;
    "console/table": ConsoleTableNode;
    "console/time": ConsoleTimeNode;
    "console/timeEnd": ConsoleTimeEndNode;
    "console/timeLog": ConsoleTimeLogNode;
    "console/trace": ConsoleTraceNode;
    "console/warn": ConsoleWarnNode;
  }
}

/**
 * Creates an interpreter for `console/*` node kinds.
 *
 * @param client - Console effect execution client.
 * @returns An Interpreter handling all console node kinds.
 */
export function createConsoleInterpreter(client: ConsoleClient): Interpreter {
  const handler = async function* (node: ConsoleAnyNode) {
    const method = node.kind.slice("console/".length) as ConsoleMethodName;
    const args: unknown[] = [];
    for (const argNode of node.args ?? []) {
      args.push(yield* eval_(argNode));
    }
    await client.call(method, args);
    return undefined;
  };

  return defineInterpreter<
    | "console/assert"
    | "console/clear"
    | "console/count"
    | "console/countReset"
    | "console/debug"
    | "console/dir"
    | "console/dirxml"
    | "console/error"
    | "console/group"
    | "console/groupCollapsed"
    | "console/groupEnd"
    | "console/info"
    | "console/log"
    | "console/table"
    | "console/time"
    | "console/timeEnd"
    | "console/timeLog"
    | "console/trace"
    | "console/warn"
  >()({
    "console/assert": handler,
    "console/clear": handler,
    "console/count": handler,
    "console/countReset": handler,
    "console/debug": handler,
    "console/dir": handler,
    "console/dirxml": handler,
    "console/error": handler,
    "console/group": handler,
    "console/groupCollapsed": handler,
    "console/groupEnd": handler,
    "console/info": handler,
    "console/log": handler,
    "console/table": handler,
    "console/time": handler,
    "console/timeEnd": handler,
    "console/timeLog": handler,
    "console/trace": handler,
    "console/warn": handler,
  });
}

/**
 * Default console interpreter that uses `globalThis.console`.
 */
export const consoleInterpreter: Interpreter = createConsoleInterpreter(
  wrapConsole(globalThis.console as unknown as ConsoleInstance),
);
