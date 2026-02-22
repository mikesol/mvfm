import type { Interpreter } from "@mvfm/core";
import { fold, type Program } from "@mvfm/core";
import { createOpenAIInterpreter, type OpenAIClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `openai/*` node kinds.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @returns An Interpreter for openai node kinds.
 */
export function serverInterpreter(client: OpenAIClient): Interpreter {
  return createOpenAIInterpreter(client);
}

/**
 * Creates a unified evaluator using the openai server interpreter.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async program evaluator function.
 */
export function serverEvaluate(
  client: OpenAIClient,
  baseInterpreter: Interpreter,
): (prog: Program) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createOpenAIInterpreter(client) };
  return (prog: Program) => fold(interp, prog);
}
