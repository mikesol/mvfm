import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createFetchInterpreter, type FetchClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `fetch/*` node kinds.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @returns An Interpreter for fetch node kinds.
 */
export function serverInterpreter(client: FetchClient): Interpreter {
  return createFetchInterpreter(client);
}

/**
 * Creates a unified evaluator using the fetch server interpreter.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: FetchClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createFetchInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
