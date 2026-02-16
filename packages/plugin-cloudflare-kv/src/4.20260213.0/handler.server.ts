import type { Interpreter, TypedNode } from "@mvfm/core";
import { foldAST } from "@mvfm/core";
import { type CloudflareKvClient, createCloudflareKvInterpreter } from "./interpreter";

/**
 * Creates a server-side interpreter for `cloudflare-kv/*` node kinds.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns An Interpreter for cloudflare-kv node kinds.
 */
export function serverInterpreter(client: CloudflareKvClient): Interpreter {
  return createCloudflareKvInterpreter(client);
}

/**
 * Creates a unified evaluator using the cloudflare-kv server interpreter.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: CloudflareKvClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = { ...baseInterpreter, ...createCloudflareKvInterpreter(client) };
  return (root: TypedNode) => foldAST(interp, root);
}
