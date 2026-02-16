import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { createRedisInterpreter, type RedisClient } from "./interpreter";

/**
 * Creates a server-side interpreter for `redis/*` node kinds.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns An Interpreter for redis node kinds.
 */
export function serverInterpreter(client: RedisClient): Interpreter {
  return createRedisInterpreter(client);
}

/**
 * Creates a unified evaluator using the redis server interpreter.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: RedisClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createRedisInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
