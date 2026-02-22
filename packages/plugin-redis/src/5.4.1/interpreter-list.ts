import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import type { RedisClient } from "./interpreter";

/**
 * Builds interpreter handlers for `redis/l*` and `redis/r*` list commands.
 *
 * Split from the main interpreter to stay under the 300-line file limit.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns A partial Interpreter handling redis list node kinds.
 */
export function buildListHandlers(client: RedisClient): Interpreter {
  return {
    "redis/lpush": async function* (entry: RuntimeEntry) {
      const key = yield 0;
      const elements: unknown[] = [];
      for (let i = 1; i < entry.children.length; i++) {
        elements.push(yield i);
      }
      return (await client.command("LPUSH", key, ...elements)) as number;
    },

    "redis/rpush": async function* (entry: RuntimeEntry) {
      const key = yield 0;
      const elements: unknown[] = [];
      for (let i = 1; i < entry.children.length; i++) {
        elements.push(yield i);
      }
      return (await client.command("RPUSH", key, ...elements)) as number;
    },

    "redis/lpop": async function* (entry: RuntimeEntry) {
      const args: unknown[] = [yield 0];
      if (entry.children.length > 1) args.push(yield 1);
      return (await client.command("LPOP", ...args)) as string | null | string[];
    },

    "redis/rpop": async function* (entry: RuntimeEntry) {
      const args: unknown[] = [yield 0];
      if (entry.children.length > 1) args.push(yield 1);
      return (await client.command("RPOP", ...args)) as string | null | string[];
    },

    "redis/llen": async function* (_entry: RuntimeEntry) {
      return (await client.command("LLEN", yield 0)) as number;
    },

    "redis/lrange": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const start = yield 1;
      const stop = yield 2;
      return (await client.command("LRANGE", key, start, stop)) as string[];
    },

    "redis/lindex": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const index = yield 1;
      return (await client.command("LINDEX", key, index)) as string | null;
    },

    "redis/lset": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const index = yield 1;
      const element = yield 2;
      return (await client.command("LSET", key, index, element)) as "OK";
    },

    "redis/lrem": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const count = yield 1;
      const element = yield 2;
      return (await client.command("LREM", key, count, element)) as number;
    },

    "redis/linsert": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const position = yield 1;
      const pivot = yield 2;
      const element = yield 3;
      return (await client.command("LINSERT", key, position, pivot, element)) as number;
    },
  };
}
