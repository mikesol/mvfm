import type { CExpr, Liftable } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

/**
 * Builds the redis constructor methods using makeCExpr.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes -- it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 *
 * Structured values (objects/arrays) are passed directly to makeCExpr;
 * the core shapes + resolveStructured system handles recursive resolution.
 */
export function buildRedisApi() {
  return {
    /** Get the value of a key. */
    get<A>(key: A): CExpr<string | null, "redis/get", [A]> {
      return makeCExpr("redis/get", [key]) as any;
    },
    /**
     * Set a key to a value with optional positional flags.
     * Matches ioredis signature: `set(key, value, "EX", 60, "NX")`
     */
    set<A, B, C extends readonly unknown[]>(
      key: A,
      value: B,
      ...args: C
    ): CExpr<string | null, "redis/set", [A, B, ...C]> {
      return makeCExpr("redis/set", [key, value, ...args]) as any;
    },
    /** Increment the integer value of a key by one. */
    incr<A>(key: A): CExpr<number, "redis/incr", [A]> {
      return makeCExpr("redis/incr", [key]) as any;
    },
    /** Increment the integer value of a key by a given amount. */
    incrby<A, B>(key: A, increment: B): CExpr<number, "redis/incrby", [A, B]> {
      return makeCExpr("redis/incrby", [key, increment]) as any;
    },
    /** Decrement the integer value of a key by one. */
    decr<A>(key: A): CExpr<number, "redis/decr", [A]> {
      return makeCExpr("redis/decr", [key]) as any;
    },
    /** Decrement the integer value of a key by a given amount. */
    decrby<A, B>(key: A, decrement: B): CExpr<number, "redis/decrby", [A, B]> {
      return makeCExpr("redis/decrby", [key, decrement]) as any;
    },
    /** Get the values of multiple keys. */
    mget<A extends readonly unknown[]>(...keys: A): CExpr<(string | null)[], "redis/mget", A> {
      return makeCExpr("redis/mget", [...keys]) as any;
    },
    /** Set multiple key-value pairs. */
    mset(mapping: Liftable<Record<string, string>>): CExpr<"OK", "redis/mset", [Liftable<Record<string, string>>]> {
      return makeCExpr("redis/mset", [mapping]) as any;
    },
    /** Append a value to a key. */
    append<A, B>(key: A, value: B): CExpr<number, "redis/append", [A, B]> {
      return makeCExpr("redis/append", [key, value]) as any;
    },
    /** Get a substring of the string stored at a key. */
    getrange<A, B, C>(key: A, start: B, end: C): CExpr<string, "redis/getrange", [A, B, C]> {
      return makeCExpr("redis/getrange", [key, start, end]) as any;
    },
    /** Overwrite part of a string at key starting at the specified offset. */
    setrange<A, B, C>(key: A, offset: B, value: C): CExpr<number, "redis/setrange", [A, B, C]> {
      return makeCExpr("redis/setrange", [key, offset, value]) as any;
    },
    /** Delete one or more keys. */
    del<A extends readonly unknown[]>(...keys: A): CExpr<number, "redis/del", A> {
      return makeCExpr("redis/del", [...keys]) as any;
    },
    /** Check if one or more keys exist. */
    exists<A extends readonly unknown[]>(...keys: A): CExpr<number, "redis/exists", A> {
      return makeCExpr("redis/exists", [...keys]) as any;
    },
    /** Set a timeout on a key (seconds). */
    expire<A, B>(key: A, seconds: B): CExpr<number, "redis/expire", [A, B]> {
      return makeCExpr("redis/expire", [key, seconds]) as any;
    },
    /** Set a timeout on a key (milliseconds). */
    pexpire<A, B>(key: A, milliseconds: B): CExpr<number, "redis/pexpire", [A, B]> {
      return makeCExpr("redis/pexpire", [key, milliseconds]) as any;
    },
    /** Get the remaining TTL of a key (seconds). */
    ttl<A>(key: A): CExpr<number, "redis/ttl", [A]> {
      return makeCExpr("redis/ttl", [key]) as any;
    },
    /** Get the remaining TTL of a key (milliseconds). */
    pttl<A>(key: A): CExpr<number, "redis/pttl", [A]> {
      return makeCExpr("redis/pttl", [key]) as any;
    },
    /** Get the value of a hash field. */
    hget<A, B>(key: A, field: B): CExpr<string | null, "redis/hget", [A, B]> {
      return makeCExpr("redis/hget", [key, field]) as any;
    },
    /** Set fields in a hash. */
    hset(key: string | CExpr<string>, mapping: Liftable<Record<string, string>>): CExpr<number, "redis/hset", [string | CExpr<string>, Liftable<Record<string, string>>]> {
      return makeCExpr("redis/hset", [key, mapping]) as any;
    },
    /** Get the values of multiple hash fields. */
    hmget<A, B extends readonly unknown[]>(
      key: A,
      ...fields: B
    ): CExpr<(string | null)[], "redis/hmget", [A, ...B]> {
      return makeCExpr("redis/hmget", [key, ...fields]) as any;
    },
    /** Get all fields and values in a hash as a flat key/value array. */
    hgetall<A>(key: A): CExpr<string[], "redis/hgetall", [A]> {
      return makeCExpr("redis/hgetall", [key]) as any;
    },
    /** Delete one or more hash fields. */
    hdel<A, B extends readonly unknown[]>(
      key: A,
      ...fields: B
    ): CExpr<number, "redis/hdel", [A, ...B]> {
      return makeCExpr("redis/hdel", [key, ...fields]) as any;
    },
    /** Check if a hash field exists. */
    hexists<A, B>(key: A, field: B): CExpr<number, "redis/hexists", [A, B]> {
      return makeCExpr("redis/hexists", [key, field]) as any;
    },
    /** Get the number of fields in a hash. */
    hlen<A>(key: A): CExpr<number, "redis/hlen", [A]> {
      return makeCExpr("redis/hlen", [key]) as any;
    },
    /** Get all field names in a hash. */
    hkeys<A>(key: A): CExpr<string[], "redis/hkeys", [A]> {
      return makeCExpr("redis/hkeys", [key]) as any;
    },
    /** Get all values in a hash. */
    hvals<A>(key: A): CExpr<string[], "redis/hvals", [A]> {
      return makeCExpr("redis/hvals", [key]) as any;
    },
    /** Increment the integer value of a hash field. */
    hincrby<A, B, C>(key: A, field: B, increment: C): CExpr<number, "redis/hincrby", [A, B, C]> {
      return makeCExpr("redis/hincrby", [key, field, increment]) as any;
    },
    /** Prepend elements to a list. */
    lpush<A, B extends readonly unknown[]>(
      key: A,
      ...elements: B
    ): CExpr<number, "redis/lpush", [A, ...B]> {
      return makeCExpr("redis/lpush", [key, ...elements]) as any;
    },
    /** Append elements to a list. */
    rpush<A, B extends readonly unknown[]>(
      key: A,
      ...elements: B
    ): CExpr<number, "redis/rpush", [A, ...B]> {
      return makeCExpr("redis/rpush", [key, ...elements]) as any;
    },
    /** Remove and return the first element(s) of a list. */
    lpop<A>(
      key: A,
      count?: unknown,
    ): CExpr<string | null | string[], "redis/lpop", [A, ...unknown[]]> {
      if (count != null) {
        return makeCExpr("redis/lpop", [key, count]) as any;
      }
      return makeCExpr("redis/lpop", [key]) as any;
    },
    /** Remove and return the last element(s) of a list. */
    rpop<A>(
      key: A,
      count?: unknown,
    ): CExpr<string | null | string[], "redis/rpop", [A, ...unknown[]]> {
      if (count != null) {
        return makeCExpr("redis/rpop", [key, count]) as any;
      }
      return makeCExpr("redis/rpop", [key]) as any;
    },
    /** Get the length of a list. */
    llen<A>(key: A): CExpr<number, "redis/llen", [A]> {
      return makeCExpr("redis/llen", [key]) as any;
    },
    /** Get a range of elements from a list. */
    lrange<A, B, C>(key: A, start: B, stop: C): CExpr<string[], "redis/lrange", [A, B, C]> {
      return makeCExpr("redis/lrange", [key, start, stop]) as any;
    },
    /** Get an element by index. */
    lindex<A, B>(key: A, index: B): CExpr<string | null, "redis/lindex", [A, B]> {
      return makeCExpr("redis/lindex", [key, index]) as any;
    },
    /** Set the value of an element by index. */
    lset<A, B, C>(key: A, index: B, element: C): CExpr<"OK", "redis/lset", [A, B, C]> {
      return makeCExpr("redis/lset", [key, index, element]) as any;
    },
    /** Remove elements from a list. */
    lrem<A, B, C>(key: A, count: B, element: C): CExpr<number, "redis/lrem", [A, B, C]> {
      return makeCExpr("redis/lrem", [key, count, element]) as any;
    },
    /** Insert an element before or after a pivot element. */
    linsert<A, B, C>(
      key: A,
      position: "BEFORE" | "AFTER",
      pivot: B,
      element: C,
    ): CExpr<number, "redis/linsert", [A, string, B, C]> {
      return makeCExpr("redis/linsert", [key, position, pivot, element]) as any;
    },
  };
}
