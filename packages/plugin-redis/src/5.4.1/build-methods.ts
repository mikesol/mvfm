import type { CExpr } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helpers restore the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

/**
 * Builds the redis constructor methods using makeCExpr + liftArg.
 *
 * Each method produces a CExpr node with positional children.
 * Config is NOT stored on AST nodes — it's captured by the interpreter.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
export function buildRedisApi() {
  return {
    /** Get the value of a key. */
    get<A>(key: A): CExpr<string | null, "redis/get", [A]> {
      return mk("redis/get", [liftArg(key)]);
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
      return mk("redis/set", [liftArg(key), liftArg(value), ...args.map((a) => liftArg(a))]);
    },
    /** Increment the integer value of a key by one. */
    incr<A>(key: A): CExpr<number, "redis/incr", [A]> {
      return mk("redis/incr", [liftArg(key)]);
    },
    /** Increment the integer value of a key by a given amount. */
    incrby<A, B>(key: A, increment: B): CExpr<number, "redis/incrby", [A, B]> {
      return mk("redis/incrby", [liftArg(key), liftArg(increment)]);
    },
    /** Decrement the integer value of a key by one. */
    decr<A>(key: A): CExpr<number, "redis/decr", [A]> {
      return mk("redis/decr", [liftArg(key)]);
    },
    /** Decrement the integer value of a key by a given amount. */
    decrby<A, B>(key: A, decrement: B): CExpr<number, "redis/decrby", [A, B]> {
      return mk("redis/decrby", [liftArg(key), liftArg(decrement)]);
    },
    /** Get the values of multiple keys. */
    mget<A extends readonly unknown[]>(
      ...keys: A
    ): CExpr<(string | null)[], "redis/mget", A> {
      return mk("redis/mget", keys.map((k) => liftArg(k)));
    },
    /** Set multiple key-value pairs. */
    mset<A>(mapping: A): CExpr<"OK", "redis/mset", [A]> {
      return mk("redis/mset", [liftArg(mapping)]);
    },
    /** Append a value to a key. */
    append<A, B>(key: A, value: B): CExpr<number, "redis/append", [A, B]> {
      return mk("redis/append", [liftArg(key), liftArg(value)]);
    },
    /** Get a substring of the string stored at a key. */
    getrange<A, B, C>(
      key: A,
      start: B,
      end: C,
    ): CExpr<string, "redis/getrange", [A, B, C]> {
      return mk("redis/getrange", [liftArg(key), liftArg(start), liftArg(end)]);
    },
    /** Overwrite part of a string at key starting at the specified offset. */
    setrange<A, B, C>(
      key: A,
      offset: B,
      value: C,
    ): CExpr<number, "redis/setrange", [A, B, C]> {
      return mk("redis/setrange", [liftArg(key), liftArg(offset), liftArg(value)]);
    },
    /** Delete one or more keys. */
    del<A extends readonly unknown[]>(
      ...keys: A
    ): CExpr<number, "redis/del", A> {
      return mk("redis/del", keys.map((k) => liftArg(k)));
    },
    /** Check if one or more keys exist. */
    exists<A extends readonly unknown[]>(
      ...keys: A
    ): CExpr<number, "redis/exists", A> {
      return mk("redis/exists", keys.map((k) => liftArg(k)));
    },
    /** Set a timeout on a key (seconds). */
    expire<A, B>(key: A, seconds: B): CExpr<number, "redis/expire", [A, B]> {
      return mk("redis/expire", [liftArg(key), liftArg(seconds)]);
    },
    /** Set a timeout on a key (milliseconds). */
    pexpire<A, B>(key: A, milliseconds: B): CExpr<number, "redis/pexpire", [A, B]> {
      return mk("redis/pexpire", [liftArg(key), liftArg(milliseconds)]);
    },
    /** Get the remaining TTL of a key (seconds). */
    ttl<A>(key: A): CExpr<number, "redis/ttl", [A]> {
      return mk("redis/ttl", [liftArg(key)]);
    },
    /** Get the remaining TTL of a key (milliseconds). */
    pttl<A>(key: A): CExpr<number, "redis/pttl", [A]> {
      return mk("redis/pttl", [liftArg(key)]);
    },
    /** Get the value of a hash field. */
    hget<A, B>(key: A, field: B): CExpr<string | null, "redis/hget", [A, B]> {
      return mk("redis/hget", [liftArg(key), liftArg(field)]);
    },
    /** Set fields in a hash. */
    hset<A, B>(key: A, mapping: B): CExpr<number, "redis/hset", [A, B]> {
      return mk("redis/hset", [liftArg(key), liftArg(mapping)]);
    },
    /** Get the values of multiple hash fields. */
    hmget<A, B extends readonly unknown[]>(
      key: A,
      ...fields: B
    ): CExpr<(string | null)[], "redis/hmget", [A, ...B]> {
      return mk("redis/hmget", [liftArg(key), ...fields.map((f) => liftArg(f))]);
    },
    /** Get all fields and values in a hash as a flat key/value array. */
    hgetall<A>(key: A): CExpr<string[], "redis/hgetall", [A]> {
      return mk("redis/hgetall", [liftArg(key)]);
    },
    /** Delete one or more hash fields. */
    hdel<A, B extends readonly unknown[]>(
      key: A,
      ...fields: B
    ): CExpr<number, "redis/hdel", [A, ...B]> {
      return mk("redis/hdel", [liftArg(key), ...fields.map((f) => liftArg(f))]);
    },
    /** Check if a hash field exists. */
    hexists<A, B>(key: A, field: B): CExpr<number, "redis/hexists", [A, B]> {
      return mk("redis/hexists", [liftArg(key), liftArg(field)]);
    },
    /** Get the number of fields in a hash. */
    hlen<A>(key: A): CExpr<number, "redis/hlen", [A]> {
      return mk("redis/hlen", [liftArg(key)]);
    },
    /** Get all field names in a hash. */
    hkeys<A>(key: A): CExpr<string[], "redis/hkeys", [A]> {
      return mk("redis/hkeys", [liftArg(key)]);
    },
    /** Get all values in a hash. */
    hvals<A>(key: A): CExpr<string[], "redis/hvals", [A]> {
      return mk("redis/hvals", [liftArg(key)]);
    },
    /** Increment the integer value of a hash field. */
    hincrby<A, B, C>(
      key: A,
      field: B,
      increment: C,
    ): CExpr<number, "redis/hincrby", [A, B, C]> {
      return mk("redis/hincrby", [liftArg(key), liftArg(field), liftArg(increment)]);
    },
    /** Prepend elements to a list. */
    lpush<A, B extends readonly unknown[]>(
      key: A,
      ...elements: B
    ): CExpr<number, "redis/lpush", [A, ...B]> {
      return mk("redis/lpush", [liftArg(key), ...elements.map((e) => liftArg(e))]);
    },
    /** Append elements to a list. */
    rpush<A, B extends readonly unknown[]>(
      key: A,
      ...elements: B
    ): CExpr<number, "redis/rpush", [A, ...B]> {
      return mk("redis/rpush", [liftArg(key), ...elements.map((e) => liftArg(e))]);
    },
    /** Remove and return the first element(s) of a list. */
    lpop<A>(
      key: A,
      count?: unknown,
    ): CExpr<string | null | string[], "redis/lpop", [A, ...unknown[]]> {
      if (count != null) {
        return mk("redis/lpop", [liftArg(key), liftArg(count)]);
      }
      return mk("redis/lpop", [liftArg(key)]);
    },
    /** Remove and return the last element(s) of a list. */
    rpop<A>(
      key: A,
      count?: unknown,
    ): CExpr<string | null | string[], "redis/rpop", [A, ...unknown[]]> {
      if (count != null) {
        return mk("redis/rpop", [liftArg(key), liftArg(count)]);
      }
      return mk("redis/rpop", [liftArg(key)]);
    },
    /** Get the length of a list. */
    llen<A>(key: A): CExpr<number, "redis/llen", [A]> {
      return mk("redis/llen", [liftArg(key)]);
    },
    /** Get a range of elements from a list. */
    lrange<A, B, C>(
      key: A,
      start: B,
      stop: C,
    ): CExpr<string[], "redis/lrange", [A, B, C]> {
      return mk("redis/lrange", [liftArg(key), liftArg(start), liftArg(stop)]);
    },
    /** Get an element by index. */
    lindex<A, B>(key: A, index: B): CExpr<string | null, "redis/lindex", [A, B]> {
      return mk("redis/lindex", [liftArg(key), liftArg(index)]);
    },
    /** Set the value of an element by index. */
    lset<A, B, C>(
      key: A,
      index: B,
      element: C,
    ): CExpr<"OK", "redis/lset", [A, B, C]> {
      return mk("redis/lset", [liftArg(key), liftArg(index), liftArg(element)]);
    },
    /** Remove elements from a list. */
    lrem<A, B, C>(
      key: A,
      count: B,
      element: C,
    ): CExpr<number, "redis/lrem", [A, B, C]> {
      return mk("redis/lrem", [liftArg(key), liftArg(count), liftArg(element)]);
    },
    /** Insert an element before or after a pivot element. */
    linsert<A, B, C>(
      key: A,
      position: "BEFORE" | "AFTER",
      pivot: B,
      element: C,
    ): CExpr<number, "redis/linsert", [A, string, B, C]> {
      return mk("redis/linsert", [liftArg(key), position, liftArg(pivot), liftArg(element)]);
    },
  };
}
