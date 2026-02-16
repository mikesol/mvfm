import type { Expr, PluginContext } from "@mvfm/core";
import type { RedisConfig, RedisMethods } from "./types";

type RedisValue = Expr<string | number> | string | number;

export function buildRedisMethods(ctx: PluginContext, resolvedConfig: RedisConfig): RedisMethods {
  const resolveKey = (key: Expr<string> | string) =>
    ctx.isExpr(key) ? key.__node : ctx.lift(key).__node;
  const resolveValue = (value: Expr<unknown> | unknown) =>
    ctx.isExpr(value) ? value.__node : ctx.lift(value).__node;
  const resolveKeys = (...keys: (Expr<string> | string)[]) => keys.map((k) => resolveKey(k));

  return {
    redis: {
      get(key) {
        return ctx.expr({ kind: "redis/get", key: resolveKey(key), config: resolvedConfig });
      },
      set(key, value, ...args) {
        return ctx.expr({
          kind: "redis/set",
          key: resolveKey(key),
          value: resolveValue(value),
          args: args.map((a) => resolveValue(a)),
          config: resolvedConfig,
        });
      },
      incr(key) {
        return ctx.expr({ kind: "redis/incr", key: resolveKey(key), config: resolvedConfig });
      },
      incrby(key, increment) {
        return ctx.expr({
          kind: "redis/incrby",
          key: resolveKey(key),
          increment: resolveValue(increment),
          config: resolvedConfig,
        });
      },
      decr(key) {
        return ctx.expr({ kind: "redis/decr", key: resolveKey(key), config: resolvedConfig });
      },
      decrby(key, decrement) {
        return ctx.expr({
          kind: "redis/decrby",
          key: resolveKey(key),
          decrement: resolveValue(decrement),
          config: resolvedConfig,
        });
      },
      mget(...keys) {
        return ctx.expr({ kind: "redis/mget", keys: resolveKeys(...keys), config: resolvedConfig });
      },
      mset(mapping) {
        return ctx.expr({
          kind: "redis/mset",
          mapping: resolveValue(mapping),
          config: resolvedConfig,
        });
      },
      append(key, value) {
        return ctx.expr({
          kind: "redis/append",
          key: resolveKey(key),
          value: resolveValue(value),
          config: resolvedConfig,
        });
      },
      getrange(key, start, end) {
        return ctx.expr({
          kind: "redis/getrange",
          key: resolveKey(key),
          start: resolveValue(start),
          end: resolveValue(end),
          config: resolvedConfig,
        });
      },
      setrange(key, offset, value) {
        return ctx.expr({
          kind: "redis/setrange",
          key: resolveKey(key),
          offset: resolveValue(offset),
          value: resolveValue(value),
          config: resolvedConfig,
        });
      },
      del(...keys) {
        return ctx.expr({ kind: "redis/del", keys: resolveKeys(...keys), config: resolvedConfig });
      },
      exists(...keys) {
        return ctx.expr({
          kind: "redis/exists",
          keys: resolveKeys(...keys),
          config: resolvedConfig,
        });
      },
      expire(key, seconds) {
        return ctx.expr({
          kind: "redis/expire",
          key: resolveKey(key),
          seconds: resolveValue(seconds),
          config: resolvedConfig,
        });
      },
      pexpire(key, milliseconds) {
        return ctx.expr({
          kind: "redis/pexpire",
          key: resolveKey(key),
          milliseconds: resolveValue(milliseconds),
          config: resolvedConfig,
        });
      },
      ttl(key) {
        return ctx.expr({ kind: "redis/ttl", key: resolveKey(key), config: resolvedConfig });
      },
      pttl(key) {
        return ctx.expr({ kind: "redis/pttl", key: resolveKey(key), config: resolvedConfig });
      },
      hget(key, field) {
        return ctx.expr({
          kind: "redis/hget",
          key: resolveKey(key),
          field: resolveKey(field),
          config: resolvedConfig,
        });
      },
      hset(key, mapping) {
        return ctx.expr({
          kind: "redis/hset",
          key: resolveKey(key),
          mapping: resolveValue(mapping),
          config: resolvedConfig,
        });
      },
      hmget(key, ...fields) {
        return ctx.expr({
          kind: "redis/hmget",
          key: resolveKey(key),
          fields: resolveKeys(...fields),
          config: resolvedConfig,
        });
      },
      hgetall(key) {
        return ctx.expr({ kind: "redis/hgetall", key: resolveKey(key), config: resolvedConfig });
      },
      hdel(key, ...fields) {
        return ctx.expr({
          kind: "redis/hdel",
          key: resolveKey(key),
          fields: resolveKeys(...fields),
          config: resolvedConfig,
        });
      },
      hexists(key, field) {
        return ctx.expr({
          kind: "redis/hexists",
          key: resolveKey(key),
          field: resolveKey(field),
          config: resolvedConfig,
        });
      },
      hlen(key) {
        return ctx.expr({ kind: "redis/hlen", key: resolveKey(key), config: resolvedConfig });
      },
      hkeys(key) {
        return ctx.expr({ kind: "redis/hkeys", key: resolveKey(key), config: resolvedConfig });
      },
      hvals(key) {
        return ctx.expr({ kind: "redis/hvals", key: resolveKey(key), config: resolvedConfig });
      },
      hincrby(key, field, increment) {
        return ctx.expr({
          kind: "redis/hincrby",
          key: resolveKey(key),
          field: resolveKey(field),
          increment: resolveValue(increment),
          config: resolvedConfig,
        });
      },
      lpush(key, ...elements) {
        return ctx.expr({
          kind: "redis/lpush",
          key: resolveKey(key),
          elements: elements.map((e) => resolveValue(e)),
          config: resolvedConfig,
        });
      },
      rpush(key, ...elements) {
        return ctx.expr({
          kind: "redis/rpush",
          key: resolveKey(key),
          elements: elements.map((e) => resolveValue(e)),
          config: resolvedConfig,
        });
      },
      lpop(key, count?) {
        return ctx.expr({
          kind: "redis/lpop",
          key: resolveKey(key),
          count: count != null ? resolveValue(count) : null,
          config: resolvedConfig,
        });
      },
      rpop(key, count?) {
        return ctx.expr({
          kind: "redis/rpop",
          key: resolveKey(key),
          count: count != null ? resolveValue(count) : null,
          config: resolvedConfig,
        });
      },
      llen(key) {
        return ctx.expr({ kind: "redis/llen", key: resolveKey(key), config: resolvedConfig });
      },
      lrange(key, start, stop) {
        return ctx.expr({
          kind: "redis/lrange",
          key: resolveKey(key),
          start: resolveValue(start),
          stop: resolveValue(stop),
          config: resolvedConfig,
        });
      },
      lindex(key, index) {
        return ctx.expr({
          kind: "redis/lindex",
          key: resolveKey(key),
          index: resolveValue(index),
          config: resolvedConfig,
        });
      },
      lset(key, index, element) {
        return ctx.expr({
          kind: "redis/lset",
          key: resolveKey(key),
          index: resolveValue(index),
          element: resolveValue(element),
          config: resolvedConfig,
        });
      },
      lrem(key, count, element) {
        return ctx.expr({
          kind: "redis/lrem",
          key: resolveKey(key),
          count: resolveValue(count),
          element: resolveValue(element),
          config: resolvedConfig,
        });
      },
      linsert(key, position, pivot, element) {
        return ctx.expr({
          kind: "redis/linsert",
          key: resolveKey(key),
          position,
          pivot: resolveValue(pivot as RedisValue),
          element: resolveValue(element as RedisValue),
          config: resolvedConfig,
        });
      },
    },
  };
}
