import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createSlackInterpreter, type SlackClient } from "./generated/interpreter";

/**
 * Creates a server-side interpreter for `slack/*` node kinds.
 *
 * @param client - The {@link SlackClient} to execute against.
 * @returns An Interpreter for slack node kinds.
 */
export function serverInterpreter(client: SlackClient): Interpreter {
  return createSlackInterpreter(client);
}

/**
 * Creates a unified evaluator using the slack server interpreter.
 *
 * @param client - The {@link SlackClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: SlackClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createSlackInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
