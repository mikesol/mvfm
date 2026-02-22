import type { Interpreter } from "@mvfm/core";
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
