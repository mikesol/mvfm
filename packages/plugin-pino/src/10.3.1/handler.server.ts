import type { Interpreter, NExpr } from "@mvfm/core";
import { fold } from "@mvfm/core";
import { createPinoInterpreter, type PinoClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `pino/*` node kinds.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @returns An Interpreter for pino node kinds.
 */
export function serverInterpreter(client: PinoClient): Interpreter {
  return createPinoInterpreter(client);
}

/**
 * Creates a unified evaluator using the pino server interpreter.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async evaluator function for NExpr.
 */
export function serverEvaluate(
  client: PinoClient,
  baseInterpreter: Interpreter,
): (expr: NExpr<unknown, string, unknown, string>) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createPinoInterpreter(client) };
  return (expr: NExpr<unknown, string, unknown, string>) => fold(expr, interp);
}
