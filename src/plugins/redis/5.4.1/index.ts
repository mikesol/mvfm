// ============================================================
// MVFM PLUGIN: redis (ioredis compatible API)
// ============================================================
//
// Implementation status: PARTIAL (Pass 1 of 60/30/10 split)
// Plugin size: LARGE — 35 of ~200 commands
//
// Implemented (Pass 1):
//   - String commands: get, set, incr, incrby, decr, decrby,
//     mget, mset, append, getrange, setrange
//   - Key commands: del, exists, expire, pexpire, ttl, pttl
//   - Hash commands: hget, hset, hmget, hgetall, hdel, hexists,
//     hlen, hkeys, hvals, hincrby
//   - List commands: lpush, rpush, lpop, rpop, llen, lrange,
//     lindex, lset, lrem, linsert
//
// Not doable (fundamental mismatch with AST model):
//   - SUBSCRIBE/PSUBSCRIBE: Push-based, async iteration
//   - WATCH: Session-scoped optimistic locking
//   - MONITOR: Debug stream, not request/response
//
// Remaining (same command pattern, add as needed):
//   Sets (SADD, SREM, SMEMBERS, etc.), Sorted Sets (ZADD,
//   ZRANGE, etc.), Transactions (MULTI/EXEC), Streams
//   (XADD, XRANGE, XREAD), Pub/Sub subset, Lua scripting,
//   Geo, HyperLogLog, Bit ops.
//
// Deviation from ioredis:
//   MSET and HSET use object-only form (no variadic key-value pairs).
//   No Buffer variants (runtime concern, not AST-level).
//   SET uses ioredis-native positional string tokens ("EX", 60, "NX")
//   for maximum LLM fluency — zero adaptation needed.
//
// Based on source-level analysis of ioredis 5.4.1
// (github.com/redis/ioredis, lib/utils/RedisCommander.ts).
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Redis operations added to the DSL context by the redis plugin.
 *
 * Mirrors ioredis 5.4.1 command methods for strings, keys, hashes,
 * and lists. Each method produces a namespaced AST node.
 */
export interface RedisMethods {
  /** Redis operations, namespaced under `$.redis`. */
  redis: {
    // ---- String commands ----

    /** Get the value of a key. */
    get(key: Expr<string> | string): Expr<string | null>;
    /**
     * Set a key to a value with optional positional flags.
     * Matches ioredis signature: `set(key, value, "EX", 60, "NX")`
     */
    set(
      key: Expr<string> | string,
      value: Expr<string | number> | string | number,
      ...args: (Expr<string | number> | string | number)[]
    ): Expr<string | null>;
    /** Increment the integer value of a key by one. */
    incr(key: Expr<string> | string): Expr<number>;
    /** Increment the integer value of a key by a given amount. */
    incrby(key: Expr<string> | string, increment: Expr<number> | number): Expr<number>;
    /** Decrement the integer value of a key by one. */
    decr(key: Expr<string> | string): Expr<number>;
    /** Decrement the integer value of a key by a given amount. */
    decrby(key: Expr<string> | string, decrement: Expr<number> | number): Expr<number>;
    /** Get the values of multiple keys. */
    mget(...keys: (Expr<string> | string)[]): Expr<(string | null)[]>;
    /** Set multiple key-value pairs. */
    mset(
      mapping: Expr<Record<string, string | number>> | Record<string, string | number>,
    ): Expr<"OK">;
    /** Append a value to a key. */
    append(
      key: Expr<string> | string,
      value: Expr<string | number> | string | number,
    ): Expr<number>;
    /** Get a substring of the string stored at a key. */
    getrange(
      key: Expr<string> | string,
      start: Expr<number> | number,
      end: Expr<number> | number,
    ): Expr<string>;
    /** Overwrite part of a string at key starting at the specified offset. */
    setrange(
      key: Expr<string> | string,
      offset: Expr<number> | number,
      value: Expr<string | number> | string | number,
    ): Expr<number>;

    // ---- Key commands ----

    /** Delete one or more keys. */
    del(...keys: (Expr<string> | string)[]): Expr<number>;
    /** Check if one or more keys exist. */
    exists(...keys: (Expr<string> | string)[]): Expr<number>;
    /** Set a timeout on a key (seconds). */
    expire(key: Expr<string> | string, seconds: Expr<number> | number): Expr<number>;
    /** Set a timeout on a key (milliseconds). */
    pexpire(key: Expr<string> | string, milliseconds: Expr<number> | number): Expr<number>;
    /** Get the remaining TTL of a key (seconds). */
    ttl(key: Expr<string> | string): Expr<number>;
    /** Get the remaining TTL of a key (milliseconds). */
    pttl(key: Expr<string> | string): Expr<number>;

    // ---- Hash commands ----

    /** Get the value of a hash field. */
    hget(key: Expr<string> | string, field: Expr<string> | string): Expr<string | null>;
    /** Set fields in a hash. */
    hset(
      key: Expr<string> | string,
      mapping: Expr<Record<string, string | number>> | Record<string, string | number>,
    ): Expr<number>;
    /** Get the values of multiple hash fields. */
    hmget(
      key: Expr<string> | string,
      ...fields: (Expr<string> | string)[]
    ): Expr<(string | null)[]>;
    /** Get all fields and values in a hash. */
    hgetall(key: Expr<string> | string): Expr<Record<string, string>>;
    /** Delete one or more hash fields. */
    hdel(key: Expr<string> | string, ...fields: (Expr<string> | string)[]): Expr<number>;
    /** Check if a hash field exists. */
    hexists(key: Expr<string> | string, field: Expr<string> | string): Expr<number>;
    /** Get the number of fields in a hash. */
    hlen(key: Expr<string> | string): Expr<number>;
    /** Get all field names in a hash. */
    hkeys(key: Expr<string> | string): Expr<string[]>;
    /** Get all values in a hash. */
    hvals(key: Expr<string> | string): Expr<string[]>;
    /** Increment the integer value of a hash field. */
    hincrby(
      key: Expr<string> | string,
      field: Expr<string> | string,
      increment: Expr<number> | number,
    ): Expr<number>;

    // ---- List commands ----

    /** Prepend elements to a list. */
    lpush(
      key: Expr<string> | string,
      ...elements: (Expr<string | number> | string | number)[]
    ): Expr<number>;
    /** Append elements to a list. */
    rpush(
      key: Expr<string> | string,
      ...elements: (Expr<string | number> | string | number)[]
    ): Expr<number>;
    /** Remove and return the first element(s) of a list. */
    lpop(key: Expr<string> | string, count?: Expr<number> | number): Expr<string | null>;
    /** Remove and return the last element(s) of a list. */
    rpop(key: Expr<string> | string, count?: Expr<number> | number): Expr<string | null>;
    /** Get the length of a list. */
    llen(key: Expr<string> | string): Expr<number>;
    /** Get a range of elements from a list. */
    lrange(
      key: Expr<string> | string,
      start: Expr<number> | number,
      stop: Expr<number> | number,
    ): Expr<string[]>;
    /** Get an element by index. */
    lindex(key: Expr<string> | string, index: Expr<number> | number): Expr<string | null>;
    /** Set the value of an element by index. */
    lset(
      key: Expr<string> | string,
      index: Expr<number> | number,
      element: Expr<string | number> | string | number,
    ): Expr<"OK">;
    /** Remove elements from a list. */
    lrem(
      key: Expr<string> | string,
      count: Expr<number> | number,
      element: Expr<string | number> | string | number,
    ): Expr<number>;
    /** Insert an element before or after a pivot element. */
    linsert(
      key: Expr<string> | string,
      position: "BEFORE" | "AFTER",
      pivot: Expr<string | number> | string | number,
      element: Expr<string | number> | string | number,
    ): Expr<number>;
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the redis plugin.
 *
 * Mirrors the subset of ioredis RedisOptions relevant to
 * connection (host, port, auth, db selection, key prefix).
 */
export interface RedisConfig {
  /** Redis server hostname. Defaults to `"127.0.0.1"`. */
  host?: string;
  /** Redis server port. Defaults to `6379`. */
  port?: number;
  /** Redis password for AUTH. */
  password?: string;
  /** Database index. Defaults to `0`. */
  db?: number;
  /** Redis username (Redis 6+ ACL). */
  username?: string;
  /** Connection name sent via CLIENT SETNAME. */
  connectionName?: string;
  /** Prefix prepended to all keys. */
  keyPrefix?: string;
}

// ---- URL parsing ------------------------------------------

function parseRedisUrl(url: string): RedisConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
  };
}

// ---- Plugin implementation --------------------------------

/**
 * Redis plugin factory. Namespace: `redis/`.
 *
 * Creates a plugin that exposes string, key, hash, and list
 * command methods for building parameterized Redis AST nodes.
 *
 * @param config - A {@link RedisConfig} object or Redis URL string.
 * @returns A {@link PluginDefinition} for the redis plugin.
 */
export function redis(config?: RedisConfig | string): PluginDefinition<RedisMethods> {
  const resolvedConfig: RedisConfig =
    typeof config === "string"
      ? parseRedisUrl(config)
      : { host: "127.0.0.1", port: 6379, db: 0, ...config };

  return {
    name: "redis",
    nodeKinds: [
      // String commands
      "redis/get",
      "redis/set",
      "redis/incr",
      "redis/incrby",
      "redis/decr",
      "redis/decrby",
      "redis/mget",
      "redis/mset",
      "redis/append",
      "redis/getrange",
      "redis/setrange",
      // Key commands
      "redis/del",
      "redis/exists",
      "redis/expire",
      "redis/pexpire",
      "redis/ttl",
      "redis/pttl",
      // Hash commands
      "redis/hget",
      "redis/hset",
      "redis/hmget",
      "redis/hgetall",
      "redis/hdel",
      "redis/hexists",
      "redis/hlen",
      "redis/hkeys",
      "redis/hvals",
      "redis/hincrby",
      // List commands
      "redis/lpush",
      "redis/rpush",
      "redis/lpop",
      "redis/rpop",
      "redis/llen",
      "redis/lrange",
      "redis/lindex",
      "redis/lset",
      "redis/lrem",
      "redis/linsert",
    ],

    build(ctx: PluginContext): RedisMethods {
      function resolveKey(key: Expr<string> | string) {
        return ctx.isExpr(key) ? key.__node : ctx.lift(key).__node;
      }

      function resolveValue(value: Expr<unknown> | unknown) {
        return ctx.isExpr(value) ? value.__node : ctx.lift(value).__node;
      }

      function resolveKeys(...keys: (Expr<string> | string)[]) {
        return keys.map((k) => resolveKey(k));
      }

      return {
        redis: {
          // ---- String commands ----

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
            return ctx.expr({
              kind: "redis/mget",
              keys: resolveKeys(...keys),
              config: resolvedConfig,
            });
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

          // ---- Key commands ----

          del(...keys) {
            return ctx.expr({
              kind: "redis/del",
              keys: resolveKeys(...keys),
              config: resolvedConfig,
            });
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

          // ---- Hash commands ----

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
            return ctx.expr({
              kind: "redis/hgetall",
              key: resolveKey(key),
              config: resolvedConfig,
            });
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

          // ---- List commands ----

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
              pivot: resolveValue(pivot),
              element: resolveValue(element),
              config: resolvedConfig,
            });
          },
        },
      };
    },
  };
}
