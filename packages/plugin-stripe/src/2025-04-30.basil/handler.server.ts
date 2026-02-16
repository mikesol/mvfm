import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createStripeInterpreter, type StripeClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `stripe/*` node kinds.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @returns An Interpreter for stripe node kinds.
 */
export function serverInterpreter(client: StripeClient): Interpreter {
  return createStripeInterpreter(client);
}

/**
 * Creates a unified evaluator using the stripe server interpreter.
 *
 * @param client - The {@link StripeClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: StripeClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createStripeInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
