import type { Interpreter, NExpr } from "@mvfm/core";
import { fold } from "@mvfm/core";
import type { FetchConfig } from "./index";
import { createFetchInterpreter, type FetchClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `fetch/*` node kinds.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @param config - Optional fetch config with baseUrl and defaultHeaders.
 * @returns An Interpreter for fetch node kinds.
 */
export function serverInterpreter(client: FetchClient, config?: FetchConfig): Interpreter {
  return createFetchInterpreter(client, config);
}

/**
 * Creates a unified evaluator using the fetch server interpreter.
 *
 * @param client - The {@link FetchClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @param config - Optional fetch config with baseUrl and defaultHeaders.
 * @returns An async evaluator function for NExpr.
 */
export function serverEvaluate(
  client: FetchClient,
  baseInterpreter: Interpreter,
  config?: FetchConfig,
): (expr: NExpr<unknown, string, unknown, string>) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createFetchInterpreter(client, config) };
  return (expr: NExpr<unknown, string, unknown, string>) => fold(expr, interp);
}
