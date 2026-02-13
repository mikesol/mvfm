import type { RedisClient } from "./interpreter";

/**
 * Wraps an ioredis instance into a {@link RedisClient}.
 *
 * Uses `redis.call()` to send raw commands, preserving the ioredis
 * instance's connection, authentication, and retry logic.
 *
 * @param redis - A configured ioredis `Redis` instance (or compatible).
 *   Must have a `call(command, ...args)` method.
 * @returns A {@link RedisClient} adapter.
 */
export function wrapIoredis(redis: {
  call(command: string, ...args: unknown[]): Promise<unknown>;
}): RedisClient {
  return {
    async command(command: string, ...args: unknown[]): Promise<unknown> {
      return redis.call(command, ...args);
    },
  };
}
