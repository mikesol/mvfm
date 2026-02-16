import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createResendInterpreter, type ResendClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `resend/*` node kinds.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns An Interpreter for resend node kinds.
 */
export function serverInterpreter(client: ResendClient): Interpreter {
  return createResendInterpreter(client);
}

/**
 * Creates a unified evaluator using the resend server interpreter.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: ResendClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createResendInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
