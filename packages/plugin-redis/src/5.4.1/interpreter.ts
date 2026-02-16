import { eval_, typedInterpreter } from "@mvfm/core";
import type { TypedNode } from "@mvfm/core";

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

export interface RedisKeyNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
}

export interface RedisKeysNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  keys: TypedNode<string>[];
}

export interface RedisKeyValueNode<K extends string, T, V> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  value: TypedNode<V>;
}

export interface RedisHashFieldNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  field: TypedNode<string>;
}

export interface RedisHashFieldsNode<K extends string, T> extends TypedNode<T> {
  kind: K;
  key: TypedNode<string>;
  fields: TypedNode<string>[];
}

export interface RedisPushNode<K extends string> extends TypedNode<number> {
  kind: K;
  key: TypedNode<string>;
  elements: TypedNode<string | number>[];
}

export interface RedisPopNode<K extends string> extends TypedNode<string | null> {
  kind: K;
  key: TypedNode<string>;
  count?: TypedNode<number>;
}

// ---- String command nodes ----

export interface RedisGetNode extends RedisKeyNode<"redis/get", string | null> {}
export interface RedisSetNode extends TypedNode<string | null> {
  kind: "redis/set";
  key: TypedNode<string>;
  value: TypedNode<string | number>;
  args?: TypedNode<string | number>[];
}
export interface RedisIncrNode extends RedisKeyNode<"redis/incr", number> {}
export interface RedisIncrByNode extends TypedNode<number> {
  kind: "redis/incrby";
  key: TypedNode<string>;
  increment: TypedNode<number>;
}
export interface RedisDecrNode extends RedisKeyNode<"redis/decr", number> {}
export interface RedisDecrByNode extends TypedNode<number> {
  kind: "redis/decrby";
  key: TypedNode<string>;
  decrement: TypedNode<number>;
}
export interface RedisMGetNode extends RedisKeysNode<"redis/mget", (string | null)[]> {}
export interface RedisMSetNode extends TypedNode<"OK"> {
  kind: "redis/mset";
  mapping: TypedNode<Record<string, string | number>>;
}
export interface RedisAppendNode extends RedisKeyValueNode<"redis/append", number, string | number> {}
export interface RedisGetRangeNode extends TypedNode<string> {
  kind: "redis/getrange";
  key: TypedNode<string>;
  start: TypedNode<number>;
  end: TypedNode<number>;
}
export interface RedisSetRangeNode extends TypedNode<number> {
  kind: "redis/setrange";
  key: TypedNode<string>;
  offset: TypedNode<number>;
  value: TypedNode<string | number>;
}

// ---- Key command nodes ----

export interface RedisDelNode extends RedisKeysNode<"redis/del", number> {}
export interface RedisExistsNode extends RedisKeysNode<"redis/exists", number> {}
export interface RedisExpireNode extends TypedNode<number> {
  kind: "redis/expire";
  key: TypedNode<string>;
  seconds: TypedNode<number>;
}
export interface RedisPExpireNode extends TypedNode<number> {
  kind: "redis/pexpire";
  key: TypedNode<string>;
  milliseconds: TypedNode<number>;
}
export interface RedisTTLNode extends RedisKeyNode<"redis/ttl", number> {}
export interface RedisPTTLNode extends RedisKeyNode<"redis/pttl", number> {}

// ---- Hash command nodes ----

export interface RedisHGetNode extends RedisHashFieldNode<"redis/hget", string | null> {}
export interface RedisHSetNode extends TypedNode<number> {
  kind: "redis/hset";
  key: TypedNode<string>;
  mapping: TypedNode<Record<string, string | number>>;
}
export interface RedisHMGetNode extends RedisHashFieldsNode<"redis/hmget", (string | null)[]> {}
export interface RedisHGetAllNode extends RedisKeyNode<"redis/hgetall", Record<string, string>> {}
export interface RedisHDelNode extends RedisHashFieldsNode<"redis/hdel", number> {}
export interface RedisHExistsNode extends RedisHashFieldNode<"redis/hexists", number> {}
export interface RedisHLenNode extends RedisKeyNode<"redis/hlen", number> {}
export interface RedisHKeysNode extends RedisKeyNode<"redis/hkeys", string[]> {}
export interface RedisHValsNode extends RedisKeyNode<"redis/hvals", string[]> {}
export interface RedisHIncrByNode extends TypedNode<number> {
  kind: "redis/hincrby";
  key: TypedNode<string>;
  field: TypedNode<string>;
  increment: TypedNode<number>;
}

// ---- List command nodes ----

export interface RedisLPushNode extends RedisPushNode<"redis/lpush"> {}
export interface RedisRPushNode extends RedisPushNode<"redis/rpush"> {}
export interface RedisLPopNode extends RedisPopNode<"redis/lpop"> {}
export interface RedisRPopNode extends RedisPopNode<"redis/rpop"> {}
export interface RedisLLenNode extends RedisKeyNode<"redis/llen", number> {}
export interface RedisLRangeNode extends TypedNode<string[]> {
  kind: "redis/lrange";
  key: TypedNode<string>;
  start: TypedNode<number>;
  stop: TypedNode<number>;
}
export interface RedisLIndexNode extends TypedNode<string | null> {
  kind: "redis/lindex";
  key: TypedNode<string>;
  index: TypedNode<number>;
}
export interface RedisLSetNode extends TypedNode<"OK"> {
  kind: "redis/lset";
  key: TypedNode<string>;
  index: TypedNode<number>;
  element: TypedNode<string | number>;
}
export interface RedisLRemNode extends TypedNode<number> {
  kind: "redis/lrem";
  key: TypedNode<string>;
  count: TypedNode<number>;
  element: TypedNode<string | number>;
}
export interface RedisLInsertNode extends TypedNode<number> {
  kind: "redis/linsert";
  key: TypedNode<string>;
  position: "BEFORE" | "AFTER";
  pivot: TypedNode<string | number>;
  element: TypedNode<string | number>;
}

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "redis/get": RedisGetNode;
    "redis/set": RedisSetNode;
    "redis/incr": RedisIncrNode;
    "redis/incrby": RedisIncrByNode;
    "redis/decr": RedisDecrNode;
    "redis/decrby": RedisDecrByNode;
    "redis/mget": RedisMGetNode;
    "redis/mset": RedisMSetNode;
    "redis/append": RedisAppendNode;
    "redis/getrange": RedisGetRangeNode;
    "redis/setrange": RedisSetRangeNode;
    "redis/del": RedisDelNode;
    "redis/exists": RedisExistsNode;
    "redis/expire": RedisExpireNode;
    "redis/pexpire": RedisPExpireNode;
    "redis/ttl": RedisTTLNode;
    "redis/pttl": RedisPTTLNode;
    "redis/hget": RedisHGetNode;
    "redis/hset": RedisHSetNode;
    "redis/hmget": RedisHMGetNode;
    "redis/hgetall": RedisHGetAllNode;
    "redis/hdel": RedisHDelNode;
    "redis/hexists": RedisHExistsNode;
    "redis/hlen": RedisHLenNode;
    "redis/hkeys": RedisHKeysNode;
    "redis/hvals": RedisHValsNode;
    "redis/hincrby": RedisHIncrByNode;
    "redis/lpush": RedisLPushNode;
    "redis/rpush": RedisRPushNode;
    "redis/lpop": RedisLPopNode;
    "redis/rpop": RedisRPopNode;
    "redis/llen": RedisLLenNode;
    "redis/lrange": RedisLRangeNode;
    "redis/lindex": RedisLIndexNode;
    "redis/lset": RedisLSetNode;
    "redis/lrem": RedisLRemNode;
    "redis/linsert": RedisLInsertNode;
  }
}

/**
 * Creates an interpreter for `redis/*` node kinds.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns An Interpreter handling all 35 redis node kinds.
 */
export function createRedisInterpreter(client: RedisClient) {
  return typedInterpreter<
    | "redis/get" | "redis/set" | "redis/incr" | "redis/incrby"
    | "redis/decr" | "redis/decrby" | "redis/mget" | "redis/mset"
    | "redis/append" | "redis/getrange" | "redis/setrange"
    | "redis/del" | "redis/exists" | "redis/expire" | "redis/pexpire"
    | "redis/ttl" | "redis/pttl"
    | "redis/hget" | "redis/hset" | "redis/hmget" | "redis/hgetall"
    | "redis/hdel" | "redis/hexists" | "redis/hlen" | "redis/hkeys"
    | "redis/hvals" | "redis/hincrby"
    | "redis/lpush" | "redis/rpush" | "redis/lpop" | "redis/rpop"
    | "redis/llen" | "redis/lrange" | "redis/lindex" | "redis/lset"
    | "redis/lrem" | "redis/linsert"
  >()({
    // ---- String commands ----

    "redis/get": async function* (node: RedisGetNode) {
      const key = yield* eval_(node.key);
      return (await client.command("GET", key)) as string | null;
    },

    "redis/set": async function* (node: RedisSetNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      const extra: unknown[] = [];
      for (const a of node.args || []) {
        extra.push(yield* eval_(a));
      }
      return (await client.command("SET", key, value, ...extra)) as string | null;
    },

    "redis/incr": async function* (node: RedisIncrNode) {
      const key = yield* eval_(node.key);
      return (await client.command("INCR", key)) as number;
    },

    "redis/incrby": async function* (node: RedisIncrByNode) {
      const key = yield* eval_(node.key);
      const increment = yield* eval_(node.increment);
      return (await client.command("INCRBY", key, increment)) as number;
    },

    "redis/decr": async function* (node: RedisDecrNode) {
      const key = yield* eval_(node.key);
      return (await client.command("DECR", key)) as number;
    },

    "redis/decrby": async function* (node: RedisDecrByNode) {
      const key = yield* eval_(node.key);
      const decrement = yield* eval_(node.decrement);
      return (await client.command("DECRBY", key, decrement)) as number;
    },

    "redis/mget": async function* (node: RedisMGetNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return (await client.command("MGET", ...keys)) as (string | null)[];
    },

    "redis/mset": async function* (node: RedisMSetNode) {
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return (await client.command("MSET", ...flattenRecord(mapping))) as "OK";
    },

    "redis/append": async function* (node: RedisAppendNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      return (await client.command("APPEND", key, value)) as number;
    },

    "redis/getrange": async function* (node: RedisGetRangeNode) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const end = yield* eval_(node.end);
      return (await client.command("GETRANGE", key, start, end)) as string;
    },

    "redis/setrange": async function* (node: RedisSetRangeNode) {
      const key = yield* eval_(node.key);
      const offset = yield* eval_(node.offset);
      const value = yield* eval_(node.value);
      return (await client.command("SETRANGE", key, offset, value)) as number;
    },

    // ---- Key commands ----

    "redis/del": async function* (node: RedisDelNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return (await client.command("DEL", ...keys)) as number;
    },

    "redis/exists": async function* (node: RedisExistsNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) {
        keys.push(yield* eval_(k));
      }
      return (await client.command("EXISTS", ...keys)) as number;
    },

    "redis/expire": async function* (node: RedisExpireNode) {
      const key = yield* eval_(node.key);
      const seconds = yield* eval_(node.seconds);
      return (await client.command("EXPIRE", key, seconds)) as number;
    },

    "redis/pexpire": async function* (node: RedisPExpireNode) {
      const key = yield* eval_(node.key);
      const ms = yield* eval_(node.milliseconds);
      return (await client.command("PEXPIRE", key, ms)) as number;
    },

    "redis/ttl": async function* (node: RedisTTLNode) {
      const key = yield* eval_(node.key);
      return (await client.command("TTL", key)) as number;
    },

    "redis/pttl": async function* (node: RedisPTTLNode) {
      const key = yield* eval_(node.key);
      return (await client.command("PTTL", key)) as number;
    },

    // ---- Hash commands ----

    "redis/hget": async function* (node: RedisHGetNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return (await client.command("HGET", key, field)) as string | null;
    },

    "redis/hset": async function* (node: RedisHSetNode) {
      const key = yield* eval_(node.key);
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return (await client.command("HSET", key, ...flattenRecord(mapping))) as number;
    },

    "redis/hmget": async function* (node: RedisHMGetNode) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return (await client.command("HMGET", key, ...fields)) as (string | null)[];
    },

    "redis/hgetall": async function* (node: RedisHGetAllNode) {
      const key = yield* eval_(node.key);
      return (await client.command("HGETALL", key)) as Record<string, string>;
    },

    "redis/hdel": async function* (node: RedisHDelNode) {
      const key = yield* eval_(node.key);
      const fields: unknown[] = [];
      for (const f of node.fields) {
        fields.push(yield* eval_(f));
      }
      return (await client.command("HDEL", key, ...fields)) as number;
    },

    "redis/hexists": async function* (node: RedisHExistsNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      return (await client.command("HEXISTS", key, field)) as number;
    },

    "redis/hlen": async function* (node: RedisHLenNode) {
      const key = yield* eval_(node.key);
      return (await client.command("HLEN", key)) as number;
    },

    "redis/hkeys": async function* (node: RedisHKeysNode) {
      const key = yield* eval_(node.key);
      return (await client.command("HKEYS", key)) as string[];
    },

    "redis/hvals": async function* (node: RedisHValsNode) {
      const key = yield* eval_(node.key);
      return (await client.command("HVALS", key)) as string[];
    },

    "redis/hincrby": async function* (node: RedisHIncrByNode) {
      const key = yield* eval_(node.key);
      const field = yield* eval_(node.field);
      const increment = yield* eval_(node.increment);
      return (await client.command("HINCRBY", key, field, increment)) as number;
    },

    // ---- List commands ----

    "redis/lpush": async function* (node: RedisLPushNode) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return (await client.command("LPUSH", key, ...elements)) as number;
    },

    "redis/rpush": async function* (node: RedisRPushNode) {
      const key = yield* eval_(node.key);
      const elements: unknown[] = [];
      for (const e of node.elements) {
        elements.push(yield* eval_(e));
      }
      return (await client.command("RPUSH", key, ...elements)) as number;
    },

    "redis/lpop": async function* (node: RedisLPopNode) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return (await client.command("LPOP", ...args)) as string | null;
    },

    "redis/rpop": async function* (node: RedisRPopNode) {
      const key = yield* eval_(node.key);
      const args: unknown[] = [key];
      if (node.count != null) {
        args.push(yield* eval_(node.count));
      }
      return (await client.command("RPOP", ...args)) as string | null;
    },

    "redis/llen": async function* (node: RedisLLenNode) {
      const key = yield* eval_(node.key);
      return (await client.command("LLEN", key)) as number;
    },

    "redis/lrange": async function* (node: RedisLRangeNode) {
      const key = yield* eval_(node.key);
      const start = yield* eval_(node.start);
      const stop = yield* eval_(node.stop);
      return (await client.command("LRANGE", key, start, stop)) as string[];
    },

    "redis/lindex": async function* (node: RedisLIndexNode) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      return (await client.command("LINDEX", key, index)) as string | null;
    },

    "redis/lset": async function* (node: RedisLSetNode) {
      const key = yield* eval_(node.key);
      const index = yield* eval_(node.index);
      const element = yield* eval_(node.element);
      return (await client.command("LSET", key, index, element)) as "OK";
    },

    "redis/lrem": async function* (node: RedisLRemNode) {
      const key = yield* eval_(node.key);
      const count = yield* eval_(node.count);
      const element = yield* eval_(node.element);
      return (await client.command("LREM", key, count, element)) as number;
    },

    "redis/linsert": async function* (node: RedisLInsertNode) {
      const key = yield* eval_(node.key);
      const pivot = yield* eval_(node.pivot);
      const element = yield* eval_(node.element);
      return (await client.command("LINSERT", key, node.position, pivot, element)) as number;
    },
  });
}
