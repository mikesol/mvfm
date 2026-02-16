import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { type AnthropicClient, createAnthropicInterpreter } from "./interpreter";

/**
 * Creates a server-side interpreter for `anthropic/*` node kinds.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @returns An Interpreter for anthropic node kinds.
 */
export function serverInterpreter(client: AnthropicClient): Interpreter {
  return createAnthropicInterpreter(client);
}

/**
 * Creates a unified evaluator using the anthropic server interpreter.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: AnthropicClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createAnthropicInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
