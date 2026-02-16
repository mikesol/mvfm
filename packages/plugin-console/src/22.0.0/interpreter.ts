import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";
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

/**
 * Interpreter fragment for `console/*` nodes.
 */
export const consoleInterpreter: InterpreterFragment = {
  pluginName: "console",
  canHandle: (node) => node.kind.startsWith("console/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    const method = node.kind.slice("console/".length) as ConsoleMethodName;
    const argNodes = ((node.args as ASTNode[] | undefined) ?? []) as ASTNode[];
    const args: unknown[] = [];

    for (const argNode of argNodes) {
      args.push(yield { type: "recurse", child: argNode });
    }

    return yield {
      type: `console/${method}`,
      method,
      args,
    };
  },
};
