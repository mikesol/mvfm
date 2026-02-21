import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import type { RedisMethods } from "./types";

type RedisValue = CExpr<string | number> | string | number;

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `redis/record` CExprs with key-value child pairs.
 * - Arrays become `redis/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("redis/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("redis/record", pairs);
  }
  return value;
}

/**
 * Builds the redis constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 */
export function buildRedisApi(): RedisMethods["redis"] {
  return {
    get(key) {
      return makeCExpr("redis/get", [liftArg(key)]);
    },
    set(key, value, ...args) {
      return makeCExpr("redis/set", [liftArg(key), liftArg(value), ...args.map((a) => liftArg(a))]);
    },
    incr(key) {
      return makeCExpr("redis/incr", [liftArg(key)]);
    },
    incrby(key, increment) {
      return makeCExpr("redis/incrby", [liftArg(key), liftArg(increment)]);
    },
    decr(key) {
      return makeCExpr("redis/decr", [liftArg(key)]);
    },
    decrby(key, decrement) {
      return makeCExpr("redis/decrby", [liftArg(key), liftArg(decrement)]);
    },
    mget(...keys) {
      return makeCExpr(
        "redis/mget",
        keys.map((k) => liftArg(k)),
      );
    },
    mset(mapping) {
      return makeCExpr("redis/mset", [liftArg(mapping)]);
    },
    append(key, value) {
      return makeCExpr("redis/append", [liftArg(key), liftArg(value)]);
    },
    getrange(key, start, end) {
      return makeCExpr("redis/getrange", [liftArg(key), liftArg(start), liftArg(end)]);
    },
    setrange(key, offset, value) {
      return makeCExpr("redis/setrange", [liftArg(key), liftArg(offset), liftArg(value)]);
    },
    del(...keys) {
      return makeCExpr(
        "redis/del",
        keys.map((k) => liftArg(k)),
      );
    },
    exists(...keys) {
      return makeCExpr(
        "redis/exists",
        keys.map((k) => liftArg(k)),
      );
    },
    expire(key, seconds) {
      return makeCExpr("redis/expire", [liftArg(key), liftArg(seconds)]);
    },
    pexpire(key, milliseconds) {
      return makeCExpr("redis/pexpire", [liftArg(key), liftArg(milliseconds)]);
    },
    ttl(key) {
      return makeCExpr("redis/ttl", [liftArg(key)]);
    },
    pttl(key) {
      return makeCExpr("redis/pttl", [liftArg(key)]);
    },
    hget(key, field) {
      return makeCExpr("redis/hget", [liftArg(key), liftArg(field)]);
    },
    hset(key, mapping) {
      return makeCExpr("redis/hset", [liftArg(key), liftArg(mapping)]);
    },
    hmget(key, ...fields) {
      return makeCExpr("redis/hmget", [liftArg(key), ...fields.map((f) => liftArg(f))]);
    },
    hgetall(key) {
      return makeCExpr("redis/hgetall", [liftArg(key)]);
    },
    hdel(key, ...fields) {
      return makeCExpr("redis/hdel", [liftArg(key), ...fields.map((f) => liftArg(f))]);
    },
    hexists(key, field) {
      return makeCExpr("redis/hexists", [liftArg(key), liftArg(field)]);
    },
    hlen(key) {
      return makeCExpr("redis/hlen", [liftArg(key)]);
    },
    hkeys(key) {
      return makeCExpr("redis/hkeys", [liftArg(key)]);
    },
    hvals(key) {
      return makeCExpr("redis/hvals", [liftArg(key)]);
    },
    hincrby(key, field, increment) {
      return makeCExpr("redis/hincrby", [liftArg(key), liftArg(field), liftArg(increment)]);
    },
    lpush(key, ...elements) {
      return makeCExpr("redis/lpush", [liftArg(key), ...elements.map((e) => liftArg(e))]);
    },
    rpush(key, ...elements) {
      return makeCExpr("redis/rpush", [liftArg(key), ...elements.map((e) => liftArg(e))]);
    },
    lpop(key, count?) {
      if (count != null) {
        return makeCExpr("redis/lpop", [liftArg(key), liftArg(count)]);
      }
      return makeCExpr("redis/lpop", [liftArg(key)]);
    },
    rpop(key, count?) {
      if (count != null) {
        return makeCExpr("redis/rpop", [liftArg(key), liftArg(count)]);
      }
      return makeCExpr("redis/rpop", [liftArg(key)]);
    },
    llen(key) {
      return makeCExpr("redis/llen", [liftArg(key)]);
    },
    lrange(key, start, stop) {
      return makeCExpr("redis/lrange", [liftArg(key), liftArg(start), liftArg(stop)]);
    },
    lindex(key, index) {
      return makeCExpr("redis/lindex", [liftArg(key), liftArg(index)]);
    },
    lset(key, index, element) {
      return makeCExpr("redis/lset", [liftArg(key), liftArg(index), liftArg(element)]);
    },
    lrem(key, count, element) {
      return makeCExpr("redis/lrem", [liftArg(key), liftArg(count), liftArg(element)]);
    },
    linsert(key, position, pivot, element) {
      return makeCExpr("redis/linsert", [liftArg(key), position, liftArg(pivot), liftArg(element)]);
    },
  };
}
