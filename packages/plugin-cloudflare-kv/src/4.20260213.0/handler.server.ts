import type { Interpreter } from "@mvfm/core";
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
 * Creates a combined interpreter merging cloudflare-kv handlers with a base interpreter.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns A merged Interpreter for both base and cloudflare-kv node kinds.
 */
export function serverEvaluate(
  client: CloudflareKvClient,
  baseInterpreter: Interpreter,
): Interpreter {
  return { ...baseInterpreter, ...createCloudflareKvInterpreter(client) };
}
