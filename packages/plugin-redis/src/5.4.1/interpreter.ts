import { defineInterpreter, eval_ } from "@mvfm/core";
import type { REDIS_NODE_KINDS } from "./node-kinds";
import type {
  RedisAppendNode,
  RedisDecrByNode,
  RedisDecrNode,
  RedisDelNode,
  RedisExistsNode,
  RedisExpireNode,
  RedisGetNode,
  RedisGetRangeNode,
  RedisHDelNode,
  RedisHExistsNode,
  RedisHGetAllNode,
  RedisHGetNode,
  RedisHIncrByNode,
  RedisHKeysNode,
  RedisHLenNode,
  RedisHMGetNode,
  RedisHSetNode,
  RedisHValsNode,
  RedisIncrByNode,
  RedisIncrNode,
  RedisLIndexNode,
  RedisLInsertNode,
  RedisLLenNode,
  RedisLPopNode,
  RedisLPushNode,
  RedisLRangeNode,
  RedisLRemNode,
  RedisLSetNode,
  RedisMGetNode,
  RedisMSetNode,
  RedisPExpireNode,
  RedisPTTLNode,
  RedisRPopNode,
  RedisRPushNode,
  RedisSetNode,
  RedisSetRangeNode,
  RedisTTLNode,
} from "./nodes";

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

type RedisKind = (typeof REDIS_NODE_KINDS)[number];

/**
 * Creates an interpreter for `redis/*` node kinds.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns An Interpreter handling all redis node kinds.
 */
export function createRedisInterpreter(client: RedisClient) {
  return defineInterpreter<RedisKind>()({
    "redis/get": async function* (node: RedisGetNode) {
      return (await client.command("GET", yield* eval_(node.key))) as string | null;
    },
    "redis/set": async function* (node: RedisSetNode) {
      const extra: unknown[] = [];
      for (const a of node.args || []) extra.push(yield* eval_(a));
      return (await client.command(
        "SET",
        yield* eval_(node.key),
        yield* eval_(node.value),
        ...extra,
      )) as string | null;
    },
    "redis/incr": async function* (node: RedisIncrNode) {
      return (await client.command("INCR", yield* eval_(node.key))) as number;
    },
    "redis/incrby": async function* (node: RedisIncrByNode) {
      return (await client.command(
        "INCRBY",
        yield* eval_(node.key),
        yield* eval_(node.increment),
      )) as number;
    },
    "redis/decr": async function* (node: RedisDecrNode) {
      return (await client.command("DECR", yield* eval_(node.key))) as number;
    },
    "redis/decrby": async function* (node: RedisDecrByNode) {
      return (await client.command(
        "DECRBY",
        yield* eval_(node.key),
        yield* eval_(node.decrement),
      )) as number;
    },
    "redis/mget": async function* (node: RedisMGetNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) keys.push(yield* eval_(k));
      return (await client.command("MGET", ...keys)) as (string | null)[];
    },
    "redis/mset": async function* (node: RedisMSetNode) {
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return (await client.command("MSET", ...flattenRecord(mapping))) as "OK";
    },
    "redis/append": async function* (node: RedisAppendNode) {
      return (await client.command(
        "APPEND",
        yield* eval_(node.key),
        yield* eval_(node.value),
      )) as number;
    },
    "redis/getrange": async function* (node: RedisGetRangeNode) {
      return (await client.command(
        "GETRANGE",
        yield* eval_(node.key),
        yield* eval_(node.start),
        yield* eval_(node.end),
      )) as string;
    },
    "redis/setrange": async function* (node: RedisSetRangeNode) {
      return (await client.command(
        "SETRANGE",
        yield* eval_(node.key),
        yield* eval_(node.offset),
        yield* eval_(node.value),
      )) as number;
    },
    "redis/del": async function* (node: RedisDelNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) keys.push(yield* eval_(k));
      return (await client.command("DEL", ...keys)) as number;
    },
    "redis/exists": async function* (node: RedisExistsNode) {
      const keys: unknown[] = [];
      for (const k of node.keys) keys.push(yield* eval_(k));
      return (await client.command("EXISTS", ...keys)) as number;
    },
    "redis/expire": async function* (node: RedisExpireNode) {
      return (await client.command(
        "EXPIRE",
        yield* eval_(node.key),
        yield* eval_(node.seconds),
      )) as number;
    },
    "redis/pexpire": async function* (node: RedisPExpireNode) {
      return (await client.command(
        "PEXPIRE",
        yield* eval_(node.key),
        yield* eval_(node.milliseconds),
      )) as number;
    },
    "redis/ttl": async function* (node: RedisTTLNode) {
      return (await client.command("TTL", yield* eval_(node.key))) as number;
    },
    "redis/pttl": async function* (node: RedisPTTLNode) {
      return (await client.command("PTTL", yield* eval_(node.key))) as number;
    },
    "redis/hget": async function* (node: RedisHGetNode) {
      return (await client.command("HGET", yield* eval_(node.key), yield* eval_(node.field))) as
        | string
        | null;
    },
    "redis/hset": async function* (node: RedisHSetNode) {
      const mapping = (yield* eval_(node.mapping)) as Record<string, unknown>;
      return (await client.command(
        "HSET",
        yield* eval_(node.key),
        ...flattenRecord(mapping),
      )) as number;
    },
    "redis/hmget": async function* (node: RedisHMGetNode) {
      const fields: unknown[] = [];
      for (const f of node.fields) fields.push(yield* eval_(f));
      return (await client.command("HMGET", yield* eval_(node.key), ...fields)) as (
        | string
        | null
      )[];
    },
    "redis/hgetall": async function* (node: RedisHGetAllNode) {
      return (await client.command("HGETALL", yield* eval_(node.key))) as string[];
    },
    "redis/hdel": async function* (node: RedisHDelNode) {
      const fields: unknown[] = [];
      for (const f of node.fields) fields.push(yield* eval_(f));
      return (await client.command("HDEL", yield* eval_(node.key), ...fields)) as number;
    },
    "redis/hexists": async function* (node: RedisHExistsNode) {
      return (await client.command(
        "HEXISTS",
        yield* eval_(node.key),
        yield* eval_(node.field),
      )) as number;
    },
    "redis/hlen": async function* (node: RedisHLenNode) {
      return (await client.command("HLEN", yield* eval_(node.key))) as number;
    },
    "redis/hkeys": async function* (node: RedisHKeysNode) {
      return (await client.command("HKEYS", yield* eval_(node.key))) as string[];
    },
    "redis/hvals": async function* (node: RedisHValsNode) {
      return (await client.command("HVALS", yield* eval_(node.key))) as string[];
    },
    "redis/hincrby": async function* (node: RedisHIncrByNode) {
      return (await client.command(
        "HINCRBY",
        yield* eval_(node.key),
        yield* eval_(node.field),
        yield* eval_(node.increment),
      )) as number;
    },
    "redis/lpush": async function* (node: RedisLPushNode) {
      const elements: unknown[] = [];
      for (const e of node.elements) elements.push(yield* eval_(e));
      return (await client.command("LPUSH", yield* eval_(node.key), ...elements)) as number;
    },
    "redis/rpush": async function* (node: RedisRPushNode) {
      const elements: unknown[] = [];
      for (const e of node.elements) elements.push(yield* eval_(e));
      return (await client.command("RPUSH", yield* eval_(node.key), ...elements)) as number;
    },
    "redis/lpop": async function* (node: RedisLPopNode) {
      const args: unknown[] = [yield* eval_(node.key)];
      if (node.count != null) args.push(yield* eval_(node.count));
      return (await client.command("LPOP", ...args)) as string | null | string[];
    },
    "redis/rpop": async function* (node: RedisRPopNode) {
      const args: unknown[] = [yield* eval_(node.key)];
      if (node.count != null) args.push(yield* eval_(node.count));
      return (await client.command("RPOP", ...args)) as string | null | string[];
    },
    "redis/llen": async function* (node: RedisLLenNode) {
      return (await client.command("LLEN", yield* eval_(node.key))) as number;
    },
    "redis/lrange": async function* (node: RedisLRangeNode) {
      return (await client.command(
        "LRANGE",
        yield* eval_(node.key),
        yield* eval_(node.start),
        yield* eval_(node.stop),
      )) as string[];
    },
    "redis/lindex": async function* (node: RedisLIndexNode) {
      return (await client.command("LINDEX", yield* eval_(node.key), yield* eval_(node.index))) as
        | string
        | null;
    },
    "redis/lset": async function* (node: RedisLSetNode) {
      return (await client.command(
        "LSET",
        yield* eval_(node.key),
        yield* eval_(node.index),
        yield* eval_(node.element),
      )) as "OK";
    },
    "redis/lrem": async function* (node: RedisLRemNode) {
      return (await client.command(
        "LREM",
        yield* eval_(node.key),
        yield* eval_(node.count),
        yield* eval_(node.element),
      )) as number;
    },
    "redis/linsert": async function* (node: RedisLInsertNode) {
      return (await client.command(
        "LINSERT",
        yield* eval_(node.key),
        node.position,
        yield* eval_(node.pivot),
        yield* eval_(node.element),
      )) as number;
    },
  });
}
