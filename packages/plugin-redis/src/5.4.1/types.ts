import type { CExpr } from "@mvfm/core";

/**
 * Redis operations added to the DSL context by the redis plugin.
 *
 * Mirrors ioredis 5.4.1 command methods for strings, keys, hashes,
 * and lists. Each method produces a namespaced AST node.
 */
export interface RedisMethods {
  /** Redis operations, namespaced under `$.redis`. */
  redis: {
    /** Get the value of a key. */
    get(key: CExpr<string> | string): CExpr<string | null>;
    /**
     * Set a key to a value with optional positional flags.
     * Matches ioredis signature: `set(key, value, "EX", 60, "NX")`
     */
    set(
      key: CExpr<string> | string,
      value: CExpr<string | number> | string | number,
      ...args: (CExpr<string | number> | string | number)[]
    ): CExpr<string | null>;
    /** Increment the integer value of a key by one. */
    incr(key: CExpr<string> | string): CExpr<number>;
    /** Increment the integer value of a key by a given amount. */
    incrby(key: CExpr<string> | string, increment: CExpr<number> | number): CExpr<number>;
    /** Decrement the integer value of a key by one. */
    decr(key: CExpr<string> | string): CExpr<number>;
    /** Decrement the integer value of a key by a given amount. */
    decrby(key: CExpr<string> | string, decrement: CExpr<number> | number): CExpr<number>;
    /** Get the values of multiple keys. */
    mget(...keys: (CExpr<string> | string)[]): CExpr<(string | null)[]>;
    /** Set multiple key-value pairs. */
    mset(
      mapping: CExpr<Record<string, string | number>> | Record<string, string | number>,
    ): CExpr<"OK">;
    /** Append a value to a key. */
    append(
      key: CExpr<string> | string,
      value: CExpr<string | number> | string | number,
    ): CExpr<number>;
    /** Get a substring of the string stored at a key. */
    getrange(
      key: CExpr<string> | string,
      start: CExpr<number> | number,
      end: CExpr<number> | number,
    ): CExpr<string>;
    /** Overwrite part of a string at key starting at the specified offset. */
    setrange(
      key: CExpr<string> | string,
      offset: CExpr<number> | number,
      value: CExpr<string | number> | string | number,
    ): CExpr<number>;

    /** Delete one or more keys. */
    del(...keys: (CExpr<string> | string)[]): CExpr<number>;
    /** Check if one or more keys exist. */
    exists(...keys: (CExpr<string> | string)[]): CExpr<number>;
    /** Set a timeout on a key (seconds). */
    expire(key: CExpr<string> | string, seconds: CExpr<number> | number): CExpr<number>;
    /** Set a timeout on a key (milliseconds). */
    pexpire(key: CExpr<string> | string, milliseconds: CExpr<number> | number): CExpr<number>;
    /** Get the remaining TTL of a key (seconds). */
    ttl(key: CExpr<string> | string): CExpr<number>;
    /** Get the remaining TTL of a key (milliseconds). */
    pttl(key: CExpr<string> | string): CExpr<number>;

    /** Get the value of a hash field. */
    hget(key: CExpr<string> | string, field: CExpr<string> | string): CExpr<string | null>;
    /** Set fields in a hash. */
    hset(
      key: CExpr<string> | string,
      mapping: CExpr<Record<string, string | number>> | Record<string, string | number>,
    ): CExpr<number>;
    /** Get the values of multiple hash fields. */
    hmget(
      key: CExpr<string> | string,
      ...fields: (CExpr<string> | string)[]
    ): CExpr<(string | null)[]>;
    /** Get all fields and values in a hash as a flat key/value array. */
    hgetall(key: CExpr<string> | string): CExpr<string[]>;
    /** Delete one or more hash fields. */
    hdel(key: CExpr<string> | string, ...fields: (CExpr<string> | string)[]): CExpr<number>;
    /** Check if a hash field exists. */
    hexists(key: CExpr<string> | string, field: CExpr<string> | string): CExpr<number>;
    /** Get the number of fields in a hash. */
    hlen(key: CExpr<string> | string): CExpr<number>;
    /** Get all field names in a hash. */
    hkeys(key: CExpr<string> | string): CExpr<string[]>;
    /** Get all values in a hash. */
    hvals(key: CExpr<string> | string): CExpr<string[]>;
    /** Increment the integer value of a hash field. */
    hincrby(
      key: CExpr<string> | string,
      field: CExpr<string> | string,
      increment: CExpr<number> | number,
    ): CExpr<number>;

    /** Prepend elements to a list. */
    lpush(
      key: CExpr<string> | string,
      ...elements: (CExpr<string | number> | string | number)[]
    ): CExpr<number>;
    /** Append elements to a list. */
    rpush(
      key: CExpr<string> | string,
      ...elements: (CExpr<string | number> | string | number)[]
    ): CExpr<number>;
    /** Remove and return the first element(s) of a list. */
    lpop(
      key: CExpr<string> | string,
      count?: CExpr<number> | number,
    ): CExpr<string | null | string[]>;
    /** Remove and return the last element(s) of a list. */
    rpop(
      key: CExpr<string> | string,
      count?: CExpr<number> | number,
    ): CExpr<string | null | string[]>;
    /** Get the length of a list. */
    llen(key: CExpr<string> | string): CExpr<number>;
    /** Get a range of elements from a list. */
    lrange(
      key: CExpr<string> | string,
      start: CExpr<number> | number,
      stop: CExpr<number> | number,
    ): CExpr<string[]>;
    /** Get an element by index. */
    lindex(key: CExpr<string> | string, index: CExpr<number> | number): CExpr<string | null>;
    /** Set the value of an element by index. */
    lset(
      key: CExpr<string> | string,
      index: CExpr<number> | number,
      element: CExpr<string | number> | string | number,
    ): CExpr<"OK">;
    /** Remove elements from a list. */
    lrem(
      key: CExpr<string> | string,
      count: CExpr<number> | number,
      element: CExpr<string | number> | string | number,
    ): CExpr<number>;
    /** Insert an element before or after a pivot element. */
    linsert(
      key: CExpr<string> | string,
      position: "BEFORE" | "AFTER",
      pivot: CExpr<string | number> | string | number,
      element: CExpr<string | number> | string | number,
    ): CExpr<number>;
  };
}

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

export function parseRedisUrl(url: string): RedisConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
  };
}
