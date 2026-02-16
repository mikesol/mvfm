import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

/**
 * Flatten an object to alternating key-value array.
 * { a: 1, b: 2 } => ["a", 1, "b", 2]
 */
function flattenRecord(obj: Record<string, unknown>): unknown[] {
  const result: unknown[] = [];
  for (const [k, v] of Object.entries(obj)) {
    result.push(k, v);
  }
  return result;
}

interface RedisKeyNode extends TypedNode<unknown> {
  kind: string;
  key: TypedNode<string>;
}

interface RedisKeyValueNode extends TypedNode<unknown> {
  kind: string;
  key: TypedNode<string>;
  value: TypedNode;
}

interface RedisKeysNode extends TypedNode<unknown> {
  kind: string;
  keys: TypedNode<string>[];
}

/**
 * Creates an interpreter for `redis/*` node kinds.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns An Interpreter handling all 35 redis node kinds.
 */
export function createRedisInterpreter(client: RedisClient): Interpreter {
  return {
    // ---- String commands ----

    "redis/get": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("GET", key);
    },

    "redis/set": async function* (node: any) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      const extra: unknown[] = [];
      for (const a of node.args || []) {
        extra.push(yield* eval_(a));
      }
      return await client.command("SET", key, value, ...extra);
    },

    "redis/incr": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("INCR", key);
    },

    "redis/incrby": async function* (node: any) {
      const key = yield* eval_(node.key);
      const increment = yield* eval_(node.increment);
      return await client.command("INCRBY", key, increment);
    },

    "redis/decr": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("DECR", key);
    },

    "redis/decrby": async function* (node: any) {
      const key = yield* eval_(node.key);
      const decrement = yield* eval_(node.decrement);
      return await client.command("DECRBY", key, decrement);
    },

    "redis/mget": async function* (node: RedisKeysNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("MGET", ...keys);
    },

    "redis/mset": async function* (node: any) {
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return await client.command("MSET", ...flattenRecord(mapping));
    },

    "redis/append": async function* (node: RedisKeyValueNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      return await client.command("APPEND", key, value);
    },

    "redis/getrange": async function* (node: any) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const end = yield* eval_(node.end);
      return await client.command("GETRANGE", key, start, end);
    },

    "redis/setrange": async function* (node: any) {
      const key = yield* eval_(node.key);
      const offset = yield* eval_(node.offset);
      const value = yield* eval_(node.value);
      return await client.command("SETRANGE", key, offset, value);
    },

    // ---- Key commands ----

    "redis/del": async function* (node: RedisKeysNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("DEL", ...keys);
    },

    "redis/exists": async function* (node: RedisKeysNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("EXISTS", ...keys);
    },

    "redis/expire": async function* (node: any) {
      const key = yield* eval_(node.key);
      const seconds = yield* eval_(node.seconds);
      return await client.command("EXPIRE", key, seconds);
    },

    "redis/pexpire": async function* (node: any) {
      const key = yield* eval_(node.key);
      const ms = yield* eval_(node.milliseconds);
      return await client.command("PEXPIRE", key, ms);
    },

    "redis/ttl": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("TTL", key);
    },

    "redis/pttl": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("PTTL", key);
    },

    // ---- Hash commands ----

    "redis/hget": async function* (node: any) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return await client.command("HGET", key, field);
    },

    "redis/hset": async function* (node: any) {
      const key = yield* eval_(node.key);
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return await client.command("HSET", key, ...flattenRecord(mapping));
    },

    "redis/hmget": async function* (node: any) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return await client.command("HMGET", key, ...fields);
    },

    "redis/hgetall": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("HGETALL", key);
    },

    "redis/hdel": async function* (node: any) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return await client.command("HDEL", key, ...fields);
    },

    "redis/hexists": async function* (node: any) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return await client.command("HEXISTS", key, field);
    },

    "redis/hlen": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("HLEN", key);
    },

    "redis/hkeys": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("HKEYS", key);
    },

    "redis/hvals": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("HVALS", key);
    },

    "redis/hincrby": async function* (node: any) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      const increment = yield* eval_(node.increment);
      return await client.command("HINCRBY", key, field, increment);
    },

    // ---- List commands ----

    "redis/lpush": async function* (node: any) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return await client.command("LPUSH", key, ...elements);
    },

    "redis/rpush": async function* (node: any) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return await client.command("RPUSH", key, ...elements);
    },

    "redis/lpop": async function* (node: any) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return await client.command("LPOP", ...args);
    },

    "redis/rpop": async function* (node: any) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return await client.command("RPOP", ...args);
    },

    "redis/llen": async function* (node: RedisKeyNode) {
      const key = yield* eval_(node.key);
      return await client.command("LLEN", key);
    },

    "redis/lrange": async function* (node: any) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const stop = yield* eval_(node.stop);
      return await client.command("LRANGE", key, start, stop);
    },

    "redis/lindex": async function* (node: any) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      return await client.command("LINDEX", key, index);
    },

    "redis/lset": async function* (node: any) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      const element = yield* eval_(node.element);
      return await client.command("LSET", key, index, element);
    },

    "redis/lrem": async function* (node: any) {
      const key = yield* eval_(node.key);
      const count = yield* eval_(node.count);
      const element = yield* eval_(node.element);
      return await client.command("LREM", key, count, element);
    },

    "redis/linsert": async function* (node: any) {
      const key = yield* eval_(node.key);
      const pivot = yield* eval_(node.pivot);
      const element = yield* eval_(node.element);
      return await client.command("LINSERT", key, node.position, pivot, element);
    },
  };
}
