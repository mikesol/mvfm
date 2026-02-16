import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { type ConsoleClient, createConsoleInterpreter } from "./interpreter";

/**
 * Creates a server-side interpreter for `console/*` node kinds.
 *
 * @param client - Console effect execution client.
 * @returns An Interpreter for console node kinds.
 */
export function serverInterpreter(client: ConsoleClient): Interpreter {
  return createConsoleInterpreter(client);
}

/**
 * Creates a unified evaluator using the console server interpreter.
 *
 * @param client - Console effect execution client.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: ConsoleClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createConsoleInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
