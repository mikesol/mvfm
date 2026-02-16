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

interface RedisKeyNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
}

interface RedisKeysNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  keys: TypedNode<string>[];
}

interface RedisKeyValueNode<K extends string, T, V> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  value: TypedNode<V>;
}

interface RedisHashFieldNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  field: TypedNode<string>;
}

interface RedisHashFieldsNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  fields: TypedNode<string>[];
}

interface RedisPushNode<K extends string> extends TypedNode<number> {
  kind: K;
  key: TypedNode<string>;
  elements: TypedNode<string | number>[];
}

interface RedisPopNode<K extends string> extends TypedNode<string | null> {
  kind: K;
  key: TypedNode<string>;
  count?: TypedNode<number>;
}

// ---- String command nodes ----

interface RedisGetNode extends RedisKeyNode<"redis/get", string | null> {}
interface RedisSetNode extends TypedNode<string | null> {
  kind: "redis/set";
  key: TypedNode<string>;
  value: TypedNode<string | number>;
  args?: TypedNode<string | number>[];
}
interface RedisIncrNode extends RedisKeyNode<"redis/incr", number> {}
interface RedisIncrByNode extends TypedNode<number> {
  kind: "redis/incrby";
  key: TypedNode<string>;
  increment: TypedNode<number>;
}
interface RedisDecrNode extends RedisKeyNode<"redis/decr", number> {}
interface RedisDecrByNode extends TypedNode<number> {
  kind: "redis/decrby";
  key: TypedNode<string>;
  decrement: TypedNode<number>;
}
interface RedisMGetNode extends RedisKeysNode<"redis/mget", (string | null)[]> {}
interface RedisMSetNode extends TypedNode<"OK"> {
  kind: "redis/mset";
  mapping: TypedNode<Record<string, string | number>>;
}
interface RedisAppendNode extends RedisKeyValueNode<"redis/append", number, string | number> {}
interface RedisGetRangeNode extends TypedNode<string> {
  kind: "redis/getrange";
  key: TypedNode<string>;
  start: TypedNode<number>;
  end: TypedNode<number>;
}
interface RedisSetRangeNode extends TypedNode<number> {
  kind: "redis/setrange";
  key: TypedNode<string>;
  offset: TypedNode<number>;
  value: TypedNode<string | number>;
}

// ---- Key command nodes ----

interface RedisDelNode extends RedisKeysNode<"redis/del", number> {}
interface RedisExistsNode extends RedisKeysNode<"redis/exists", number> {}
interface RedisExpireNode extends TypedNode<number> {
  kind: "redis/expire";
  key: TypedNode<string>;
  seconds: TypedNode<number>;
}
interface RedisPExpireNode extends TypedNode<number> {
  kind: "redis/pexpire";
  key: TypedNode<string>;
  milliseconds: TypedNode<number>;
}
interface RedisTTLNode extends RedisKeyNode<"redis/ttl", number> {}
interface RedisPTTLNode extends RedisKeyNode<"redis/pttl", number> {}

// ---- Hash command nodes ----

interface RedisHGetNode extends RedisHashFieldNode<"redis/hget", string | null> {}
interface RedisHSetNode extends TypedNode<number> {
  kind: "redis/hset";
  key: TypedNode<string>;
  mapping: TypedNode<Record<string, string | number>>;
}
interface RedisHMGetNode extends RedisHashFieldsNode<"redis/hmget", (string | null)[]> {}
interface RedisHGetAllNode extends RedisKeyNode<"redis/hgetall", Record<string, string>> {}
interface RedisHDelNode extends RedisHashFieldsNode<"redis/hdel", number> {}
interface RedisHExistsNode extends RedisHashFieldNode<"redis/hexists", number> {}
interface RedisHLenNode extends RedisKeyNode<"redis/hlen", number> {}
interface RedisHKeysNode extends RedisKeyNode<"redis/hkeys", string[]> {}
interface RedisHValsNode extends RedisKeyNode<"redis/hvals", string[]> {}
interface RedisHIncrByNode extends TypedNode<number> {
  kind: "redis/hincrby";
  key: TypedNode<string>;
  field: TypedNode<string>;
  increment: TypedNode<number>;
}

// ---- List command nodes ----

interface RedisLPushNode extends RedisPushNode<"redis/lpush"> {}
interface RedisRPushNode extends RedisPushNode<"redis/rpush"> {}
interface RedisLPopNode extends RedisPopNode<"redis/lpop"> {}
interface RedisRPopNode extends RedisPopNode<"redis/rpop"> {}
interface RedisLLenNode extends RedisKeyNode<"redis/llen", number> {}
interface RedisLRangeNode extends TypedNode<string[]> {
  kind: "redis/lrange";
  key: TypedNode<string>;
  start: TypedNode<number>;
  stop: TypedNode<number>;
}
interface RedisLIndexNode extends TypedNode<string | null> {
  kind: "redis/lindex";
  key: TypedNode<string>;
  index: TypedNode<number>;
}
interface RedisLSetNode extends TypedNode<"OK"> {
  kind: "redis/lset";
  key: TypedNode<string>;
  index: TypedNode<number>;
  element: TypedNode<string | number>;
}
interface RedisLRemNode extends TypedNode<number> {
  kind: "redis/lrem";
  key: TypedNode<string>;
  count: TypedNode<number>;
  element: TypedNode<string | number>;
}
interface RedisLInsertNode extends TypedNode<number> {
  kind: "redis/linsert";
  key: TypedNode<string>;
  position: "BEFORE" | "AFTER";
  pivot: TypedNode<string | number>;
  element: TypedNode<string | number>;
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

    "redis/get": async function* (node: RedisGetNode) {
      const key = yield* eval_(node.key);
      return await client.command("GET", key);
    },

    "redis/set": async function* (node: RedisSetNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      const extra: unknown[] = [];
      for (const a of node.args || []) {
        extra.push(yield* eval_(a));
      }
      return await client.command("SET", key, value, ...extra);
    },

    "redis/incr": async function* (node: RedisIncrNode) {
      const key = yield* eval_(node.key);
      return await client.command("INCR", key);
    },

    "redis/incrby": async function* (node: RedisIncrByNode) {
      const key = yield* eval_(node.key);
      const increment = yield* eval_(node.increment);
      return await client.command("INCRBY", key, increment);
    },

    "redis/decr": async function* (node: RedisDecrNode) {
      const key = yield* eval_(node.key);
      return await client.command("DECR", key);
    },

    "redis/decrby": async function* (node: RedisDecrByNode) {
      const key = yield* eval_(node.key);
      const decrement = yield* eval_(node.decrement);
      return await client.command("DECRBY", key, decrement);
    },

    "redis/mget": async function* (node: RedisMGetNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("MGET", ...keys);
    },

    "redis/mset": async function* (node: RedisMSetNode) {
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return await client.command("MSET", ...flattenRecord(mapping));
    },

    "redis/append": async function* (node: RedisAppendNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      return await client.command("APPEND", key, value);
    },

    "redis/getrange": async function* (node: RedisGetRangeNode) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const end = yield* eval_(node.end);
      return await client.command("GETRANGE", key, start, end);
    },

    "redis/setrange": async function* (node: RedisSetRangeNode) {
      const key = yield* eval_(node.key);
      const offset = yield* eval_(node.offset);
      const value = yield* eval_(node.value);
      return await client.command("SETRANGE", key, offset, value);
    },

    // ---- Key commands ----

    "redis/del": async function* (node: RedisDelNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("DEL", ...keys);
    },

    "redis/exists": async function* (node: RedisExistsNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return await client.command("EXISTS", ...keys);
    },

    "redis/expire": async function* (node: RedisExpireNode) {
      const key = yield* eval_(node.key);
      const seconds = yield* eval_(node.seconds);
      return await client.command("EXPIRE", key, seconds);
    },

    "redis/pexpire": async function* (node: RedisPExpireNode) {
      const key = yield* eval_(node.key);
      const ms = yield* eval_(node.milliseconds);
      return await client.command("PEXPIRE", key, ms);
    },

    "redis/ttl": async function* (node: RedisTTLNode) {
      const key = yield* eval_(node.key);
      return await client.command("TTL", key);
    },

    "redis/pttl": async function* (node: RedisPTTLNode) {
      const key = yield* eval_(node.key);
      return await client.command("PTTL", key);
    },

    // ---- Hash commands ----

    "redis/hget": async function* (node: RedisHGetNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return await client.command("HGET", key, field);
    },

    "redis/hset": async function* (node: RedisHSetNode) {
      const key = yield* eval_(node.key);
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return await client.command("HSET", key, ...flattenRecord(mapping));
    },

    "redis/hmget": async function* (node: RedisHMGetNode) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return await client.command("HMGET", key, ...fields);
    },

    "redis/hgetall": async function* (node: RedisHGetAllNode) {
      const key = yield* eval_(node.key);
      return await client.command("HGETALL", key);
    },

    "redis/hdel": async function* (node: RedisHDelNode) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return await client.command("HDEL", key, ...fields);
    },

    "redis/hexists": async function* (node: RedisHExistsNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return await client.command("HEXISTS", key, field);
    },

    "redis/hlen": async function* (node: RedisHLenNode) {
      const key = yield* eval_(node.key);
      return await client.command("HLEN", key);
    },

    "redis/hkeys": async function* (node: RedisHKeysNode) {
      const key = yield* eval_(node.key);
      return await client.command("HKEYS", key);
    },

    "redis/hvals": async function* (node: RedisHValsNode) {
      const key = yield* eval_(node.key);
      return await client.command("HVALS", key);
    },

    "redis/hincrby": async function* (node: RedisHIncrByNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      const increment = yield* eval_(node.increment);
      return await client.command("HINCRBY", key, field, increment);
    },

    // ---- List commands ----

    "redis/lpush": async function* (node: RedisLPushNode) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return await client.command("LPUSH", key, ...elements);
    },

    "redis/rpush": async function* (node: RedisRPushNode) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return await client.command("RPUSH", key, ...elements);
    },

    "redis/lpop": async function* (node: RedisLPopNode) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return await client.command("LPOP", ...args);
    },

    "redis/rpop": async function* (node: RedisRPopNode) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return await client.command("RPOP", ...args);
    },

    "redis/llen": async function* (node: RedisLLenNode) {
      const key = yield* eval_(node.key);
      return await client.command("LLEN", key);
    },

    "redis/lrange": async function* (node: RedisLRangeNode) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const stop = yield* eval_(node.stop);
      return await client.command("LRANGE", key, start, stop);
    },

    "redis/lindex": async function* (node: RedisLIndexNode) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      return await client.command("LINDEX", key, index);
    },

    "redis/lset": async function* (node: RedisLSetNode) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      const element = yield* eval_(node.element);
      return await client.command("LSET", key, index, element);
    },

    "redis/lrem": async function* (node: RedisLRemNode) {
      const key = yield* eval_(node.key);
      const count = yield* eval_(node.count);
      const element = yield* eval_(node.element);
      return await client.command("LREM", key, count, element);
    },

    "redis/linsert": async function* (node: RedisLInsertNode) {
      const key = yield* eval_(node.key);
      const pivot = yield* eval_(node.pivot);
      const element = yield* eval_(node.element);
      return await client.command("LINSERT", key, node.position, pivot, element);
    },
  };
}
