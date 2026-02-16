import type { Expr } from "@mvfm/core";

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
