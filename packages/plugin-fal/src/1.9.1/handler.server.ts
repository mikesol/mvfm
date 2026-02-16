import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createFalInterpreter, type FalClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `fal/*` node kinds.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns An Interpreter for fal node kinds.
 */
export function serverInterpreter(client: FalClient): Interpreter {
  return createFalInterpreter(client);
}

/**
 * Creates a unified evaluator using the fal server interpreter.
 *
 * @param client - The {@link FalClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: FalClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createFalInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
