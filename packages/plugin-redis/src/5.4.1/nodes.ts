import type { TypedNode } from "@mvfm/core";

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
export interface RedisAppendNode
  extends RedisKeyValueNode<"redis/append", number, string | number> {}
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
