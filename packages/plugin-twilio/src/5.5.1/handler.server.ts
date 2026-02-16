import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createTwilioInterpreter, type TwilioClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `twilio/*` node kinds.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @returns An Interpreter for twilio node kinds.
 */
export function serverInterpreter(client: TwilioClient): Interpreter {
  return createTwilioInterpreter(client);
}

/**
 * Creates a unified evaluator using the twilio server interpreter.
 *
 * @param client - The {@link TwilioClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: TwilioClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createTwilioInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
