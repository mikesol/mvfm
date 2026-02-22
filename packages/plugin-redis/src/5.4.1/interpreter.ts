import type { Interpreter, RuntimeEntry } from "@mvfm/core";
import { buildListHandlers } from "./interpreter-list";

/**
 * Redis client interface consumed by the redis handler.
 *
 * Abstracts over ioredis so handlers can be tested with mock clients.
 * Uses a single generic `command()` method that maps to `redis.call()`.
 */
export interface RedisClient {
  /** Execute a Redis command and return the result. */
  command(command: string, ...args: unknown[]): Promise<unknown>;
}

function flattenRecord(obj: Record<string, unknown>): unknown[] {
  const result: unknown[] = [];
  for (const [k, v] of Object.entries(obj)) result.push(k, v);
  return result;
}

/**
 * Creates an interpreter for `redis/*` node kinds using the
 * RuntimeEntry + positional yield pattern.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns An Interpreter handling all redis node kinds.
 */
export function createRedisInterpreter(client: RedisClient): Interpreter {
  return {
    // ---- String commands ----

    "redis/get": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      return (await client.command("GET", key)) as string | null;
    },

    "redis/set": async function* (entry: RuntimeEntry) {
      const key = yield 0;
      const value = yield 1;
      const extra: unknown[] = [];
      for (let i = 2; i < entry.children.length; i++) {
        extra.push(yield i);
      }
      return (await client.command("SET", key, value, ...extra)) as string | null;
    },

    "redis/incr": async function* (_entry: RuntimeEntry) {
      return (await client.command("INCR", yield 0)) as number;
    },

    "redis/incrby": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const increment = yield 1;
      return (await client.command("INCRBY", key, increment)) as number;
    },

    "redis/decr": async function* (_entry: RuntimeEntry) {
      return (await client.command("DECR", yield 0)) as number;
    },

    "redis/decrby": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const decrement = yield 1;
      return (await client.command("DECRBY", key, decrement)) as number;
    },

    "redis/mget": async function* (entry: RuntimeEntry) {
      const keys: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        keys.push(yield i);
      }
      return (await client.command("MGET", ...keys)) as (string | null)[];
    },

    "redis/mset": async function* (_entry: RuntimeEntry) {
      const mapping = (yield 0) as Record<string, unknown>;
      return (await client.command("MSET", ...flattenRecord(mapping))) as "OK";
    },

    "redis/append": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const value = yield 1;
      return (await client.command("APPEND", key, value)) as number;
    },

    "redis/getrange": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const start = yield 1;
      const end = yield 2;
      return (await client.command("GETRANGE", key, start, end)) as string;
    },

    "redis/setrange": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const offset = yield 1;
      const value = yield 2;
      return (await client.command("SETRANGE", key, offset, value)) as number;
    },

    // ---- Key commands ----

    "redis/del": async function* (entry: RuntimeEntry) {
      const keys: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        keys.push(yield i);
      }
      return (await client.command("DEL", ...keys)) as number;
    },

    "redis/exists": async function* (entry: RuntimeEntry) {
      const keys: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        keys.push(yield i);
      }
      return (await client.command("EXISTS", ...keys)) as number;
    },

    "redis/expire": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const seconds = yield 1;
      return (await client.command("EXPIRE", key, seconds)) as number;
    },

    "redis/pexpire": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const milliseconds = yield 1;
      return (await client.command("PEXPIRE", key, milliseconds)) as number;
    },

    "redis/ttl": async function* (_entry: RuntimeEntry) {
      return (await client.command("TTL", yield 0)) as number;
    },

    "redis/pttl": async function* (_entry: RuntimeEntry) {
      return (await client.command("PTTL", yield 0)) as number;
    },

    // ---- Hash commands ----

    "redis/hget": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const field = yield 1;
      return (await client.command("HGET", key, field)) as string | null;
    },

    "redis/hset": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const mapping = (yield 1) as Record<string, unknown>;
      return (await client.command("HSET", key, ...flattenRecord(mapping))) as number;
    },

    "redis/hmget": async function* (entry: RuntimeEntry) {
      const key = yield 0;
      const fields: unknown[] = [];
      for (let i = 1; i < entry.children.length; i++) {
        fields.push(yield i);
      }
      return (await client.command("HMGET", key, ...fields)) as (string | null)[];
    },

    "redis/hgetall": async function* (_entry: RuntimeEntry) {
      return (await client.command("HGETALL", yield 0)) as string[];
    },

    "redis/hdel": async function* (entry: RuntimeEntry) {
      const key = yield 0;
      const fields: unknown[] = [];
      for (let i = 1; i < entry.children.length; i++) {
        fields.push(yield i);
      }
      return (await client.command("HDEL", key, ...fields)) as number;
    },

    "redis/hexists": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const field = yield 1;
      return (await client.command("HEXISTS", key, field)) as number;
    },

    "redis/hlen": async function* (_entry: RuntimeEntry) {
      return (await client.command("HLEN", yield 0)) as number;
    },

    "redis/hkeys": async function* (_entry: RuntimeEntry) {
      return (await client.command("HKEYS", yield 0)) as string[];
    },

    "redis/hvals": async function* (_entry: RuntimeEntry) {
      return (await client.command("HVALS", yield 0)) as string[];
    },

    "redis/hincrby": async function* (_entry: RuntimeEntry) {
      const key = yield 0;
      const field = yield 1;
      const increment = yield 2;
      return (await client.command("HINCRBY", key, field, increment)) as number;
    },

    // ---- List commands (delegated to interpreter-list.ts) ----
    ...buildListHandlers(client),

    // ---- Internal structural kinds ----

    "redis/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "redis/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}
