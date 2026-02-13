# Redis Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the redis plugin (Pass 1) modeling ioredis 5.4.1 for caching, rate limiting, and KV store use cases.

**Architecture:** External-service plugin at `src/plugins/redis/5.4.1/` following the same 5-file pattern as postgres and stripe. Single `redis/command` effect type for all 35 operations. SET uses ioredis-native positional string tokens (`"EX"`, `"NX"`, etc.) for maximum LLM fluency.

**Tech Stack:** TypeScript, Vitest, ioredis 5.4.1

**Design doc:** `docs/plans/2026-02-13-redis-plugin-design.md`

---

### Task 1: Plugin index.ts — types and factory with string commands

**Files:**
- Create: `src/plugins/redis/5.4.1/index.ts`
- Test: `tests/plugins/redis/5.4.1/index.test.ts`

**Step 1: Write the failing tests for GET, SET, DEL, EXISTS**

Create `tests/plugins/redis/5.4.1/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { redis } from "../../../../src/plugins/redis/5.4.1";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, redis({ host: "127.0.0.1", port: 6379 }));

// ============================================================
// String commands
// ============================================================

describe("redis: get", () => {
  it("produces redis/get node with literal key", () => {
    const prog = app(($) => $.redis.get("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("mykey");
  });

  it("accepts Expr<string> key", () => {
    const prog = app(($) => $.redis.get($.input.key));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
    expect(ast.result.key.kind).toBe("core/prop_access");
  });
});

describe("redis: set", () => {
  it("produces redis/set node with key and value", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/set");
    expect(ast.result.key.kind).toBe("core/literal");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.value.kind).toBe("core/literal");
    expect(ast.result.value.value).toBe("myvalue");
    expect(ast.result.args).toHaveLength(0);
  });

  it("produces redis/set node with EX and NX positional tokens", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EX", 60, "NX"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/set");
    expect(ast.result.args).toHaveLength(3);
    expect(ast.result.args[0].value).toBe("EX");
    expect(ast.result.args[1].value).toBe(60);
    expect(ast.result.args[2].value).toBe("NX");
  });

  it("produces redis/set node with PX token", () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "PX", 5000));
    const ast = strip(prog.ast) as any;
    expect(ast.result.args).toHaveLength(2);
    expect(ast.result.args[0].value).toBe("PX");
    expect(ast.result.args[1].value).toBe(5000);
  });

  it("accepts Expr params", () => {
    const prog = app(($) => $.redis.set($.input.key, $.input.value));
    const ast = strip(prog.ast) as any;
    expect(ast.result.key.kind).toBe("core/prop_access");
    expect(ast.result.value.kind).toBe("core/prop_access");
  });
});

describe("redis: del", () => {
  it("produces redis/del node with single key", () => {
    const prog = app(($) => $.redis.del("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/del");
    expect(ast.result.keys).toHaveLength(1);
    expect(ast.result.keys[0].kind).toBe("core/literal");
    expect(ast.result.keys[0].value).toBe("mykey");
  });

  it("produces redis/del node with multiple keys", () => {
    const prog = app(($) => $.redis.del("key1", "key2", "key3"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/del");
    expect(ast.result.keys).toHaveLength(3);
  });
});

describe("redis: exists", () => {
  it("produces redis/exists node", () => {
    const prog = app(($) => $.redis.exists("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/exists");
    expect(ast.result.keys).toHaveLength(1);
    expect(ast.result.keys[0].value).toBe("mykey");
  });
});

describe("redis: incr", () => {
  it("produces redis/incr node", () => {
    const prog = app(($) => $.redis.incr("counter"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/incr");
    expect(ast.result.key.value).toBe("counter");
  });
});

describe("redis: incrby", () => {
  it("produces redis/incrby node", () => {
    const prog = app(($) => $.redis.incrby("counter", 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/incrby");
    expect(ast.result.key.value).toBe("counter");
    expect(ast.result.increment.value).toBe(5);
  });
});

describe("redis: decr", () => {
  it("produces redis/decr node", () => {
    const prog = app(($) => $.redis.decr("counter"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/decr");
    expect(ast.result.key.value).toBe("counter");
  });
});

describe("redis: decrby", () => {
  it("produces redis/decrby node", () => {
    const prog = app(($) => $.redis.decrby("counter", 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/decrby");
    expect(ast.result.key.value).toBe("counter");
    expect(ast.result.decrement.value).toBe(3);
  });
});

describe("redis: mget", () => {
  it("produces redis/mget node", () => {
    const prog = app(($) => $.redis.mget("key1", "key2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/mget");
    expect(ast.result.keys).toHaveLength(2);
  });
});

describe("redis: mset", () => {
  it("produces redis/mset node", () => {
    const prog = app(($) => $.redis.mset({ key1: "val1", key2: "val2" }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/mset");
    expect(ast.result.mapping.kind).toBe("core/record");
  });
});

describe("redis: append", () => {
  it("produces redis/append node", () => {
    const prog = app(($) => $.redis.append("mykey", "extra"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/append");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.value.value).toBe("extra");
  });
});

describe("redis: getrange", () => {
  it("produces redis/getrange node", () => {
    const prog = app(($) => $.redis.getrange("mykey", 0, 5));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/getrange");
    expect(ast.result.start.value).toBe(0);
    expect(ast.result.end.value).toBe(5);
  });
});

describe("redis: setrange", () => {
  it("produces redis/setrange node", () => {
    const prog = app(($) => $.redis.setrange("mykey", 3, "abc"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/setrange");
    expect(ast.result.offset.value).toBe(3);
    expect(ast.result.value.value).toBe("abc");
  });
});

// ============================================================
// Key commands
// ============================================================

describe("redis: expire", () => {
  it("produces redis/expire node", () => {
    const prog = app(($) => $.redis.expire("mykey", 300));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/expire");
    expect(ast.result.key.value).toBe("mykey");
    expect(ast.result.seconds.value).toBe(300);
  });
});

describe("redis: pexpire", () => {
  it("produces redis/pexpire node", () => {
    const prog = app(($) => $.redis.pexpire("mykey", 5000));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/pexpire");
    expect(ast.result.milliseconds.value).toBe(5000);
  });
});

describe("redis: ttl", () => {
  it("produces redis/ttl node", () => {
    const prog = app(($) => $.redis.ttl("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/ttl");
    expect(ast.result.key.value).toBe("mykey");
  });
});

describe("redis: pttl", () => {
  it("produces redis/pttl node", () => {
    const prog = app(($) => $.redis.pttl("mykey"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/pttl");
    expect(ast.result.key.value).toBe("mykey");
  });
});

// ============================================================
// Hash commands
// ============================================================

describe("redis: hget", () => {
  it("produces redis/hget node", () => {
    const prog = app(($) => $.redis.hget("myhash", "field1"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hget");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.field.value).toBe("field1");
  });
});

describe("redis: hset", () => {
  it("produces redis/hset node", () => {
    const prog = app(($) => $.redis.hset("myhash", { field1: "val1", field2: "val2" }));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hset");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.mapping.kind).toBe("core/record");
  });
});

describe("redis: hmget", () => {
  it("produces redis/hmget node", () => {
    const prog = app(($) => $.redis.hmget("myhash", "f1", "f2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hmget");
    expect(ast.result.key.value).toBe("myhash");
    expect(ast.result.fields).toHaveLength(2);
  });
});

describe("redis: hgetall", () => {
  it("produces redis/hgetall node", () => {
    const prog = app(($) => $.redis.hgetall("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hgetall");
    expect(ast.result.key.value).toBe("myhash");
  });
});

describe("redis: hdel", () => {
  it("produces redis/hdel node", () => {
    const prog = app(($) => $.redis.hdel("myhash", "f1", "f2"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hdel");
    expect(ast.result.fields).toHaveLength(2);
  });
});

describe("redis: hexists", () => {
  it("produces redis/hexists node", () => {
    const prog = app(($) => $.redis.hexists("myhash", "field1"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hexists");
    expect(ast.result.field.value).toBe("field1");
  });
});

describe("redis: hlen", () => {
  it("produces redis/hlen node", () => {
    const prog = app(($) => $.redis.hlen("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hlen");
  });
});

describe("redis: hkeys", () => {
  it("produces redis/hkeys node", () => {
    const prog = app(($) => $.redis.hkeys("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hkeys");
  });
});

describe("redis: hvals", () => {
  it("produces redis/hvals node", () => {
    const prog = app(($) => $.redis.hvals("myhash"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hvals");
  });
});

describe("redis: hincrby", () => {
  it("produces redis/hincrby node", () => {
    const prog = app(($) => $.redis.hincrby("myhash", "counter", 10));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/hincrby");
    expect(ast.result.increment.value).toBe(10);
  });
});

// ============================================================
// List commands
// ============================================================

describe("redis: lpush", () => {
  it("produces redis/lpush node with multiple elements", () => {
    const prog = app(($) => $.redis.lpush("mylist", "a", "b"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpush");
    expect(ast.result.key.value).toBe("mylist");
    expect(ast.result.elements).toHaveLength(2);
  });
});

describe("redis: rpush", () => {
  it("produces redis/rpush node", () => {
    const prog = app(($) => $.redis.rpush("mylist", "c"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/rpush");
    expect(ast.result.elements).toHaveLength(1);
  });
});

describe("redis: lpop", () => {
  it("produces redis/lpop node without count", () => {
    const prog = app(($) => $.redis.lpop("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpop");
    expect(ast.result.count).toBeNull();
  });

  it("produces redis/lpop node with count", () => {
    const prog = app(($) => $.redis.lpop("mylist", 3));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lpop");
    expect(ast.result.count.value).toBe(3);
  });
});

describe("redis: rpop", () => {
  it("produces redis/rpop node", () => {
    const prog = app(($) => $.redis.rpop("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/rpop");
    expect(ast.result.count).toBeNull();
  });
});

describe("redis: llen", () => {
  it("produces redis/llen node", () => {
    const prog = app(($) => $.redis.llen("mylist"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/llen");
  });
});

describe("redis: lrange", () => {
  it("produces redis/lrange node", () => {
    const prog = app(($) => $.redis.lrange("mylist", 0, -1));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lrange");
    expect(ast.result.start.value).toBe(0);
    expect(ast.result.stop.value).toBe(-1);
  });
});

describe("redis: lindex", () => {
  it("produces redis/lindex node", () => {
    const prog = app(($) => $.redis.lindex("mylist", 2));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lindex");
    expect(ast.result.index.value).toBe(2);
  });
});

describe("redis: lset", () => {
  it("produces redis/lset node", () => {
    const prog = app(($) => $.redis.lset("mylist", 0, "newval"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lset");
    expect(ast.result.index.value).toBe(0);
    expect(ast.result.element.value).toBe("newval");
  });
});

describe("redis: lrem", () => {
  it("produces redis/lrem node", () => {
    const prog = app(($) => $.redis.lrem("mylist", 2, "val"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/lrem");
    expect(ast.result.count.value).toBe(2);
    expect(ast.result.element.value).toBe("val");
  });
});

describe("redis: linsert", () => {
  it("produces redis/linsert node with BEFORE", () => {
    const prog = app(($) => $.redis.linsert("mylist", "BEFORE", "pivot", "elem"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/linsert");
    expect(ast.result.position).toBe("BEFORE");
    expect(ast.result.pivot.value).toBe("pivot");
    expect(ast.result.element.value).toBe("elem");
  });
});

// ============================================================
// Integration
// ============================================================

describe("redis: cross-operation dependencies", () => {
  it("can use result of get as input to set", () => {
    const prog = app(($) => {
      const val = $.redis.get("source");
      const result = $.redis.set("dest", val);
      return $.do(val, result);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});

describe("redis: string URL config", () => {
  it("accepts string config", () => {
    const urlApp = ilo(num, str, redis("redis://localhost:6379/0"));
    const prog = urlApp(($) => $.redis.get("test"));
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("redis/get");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plugins/redis/5.4.1/index.test.ts`
Expected: FAIL — cannot find module `src/plugins/redis/5.4.1`

**Step 3: Write the plugin index.ts**

Create `src/plugins/redis/5.4.1/index.ts`:

```ts
// ============================================================
// ILO PLUGIN: redis (ioredis compatible API)
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
    hmget(key: Expr<string> | string, ...fields: (Expr<string> | string)[]): Expr<(string | null)[]>;
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
      "redis/get", "redis/set", "redis/incr", "redis/incrby",
      "redis/decr", "redis/decrby", "redis/mget", "redis/mset",
      "redis/append", "redis/getrange", "redis/setrange",
      // Key commands
      "redis/del", "redis/exists", "redis/expire", "redis/pexpire",
      "redis/ttl", "redis/pttl",
      // Hash commands
      "redis/hget", "redis/hset", "redis/hmget", "redis/hgetall",
      "redis/hdel", "redis/hexists", "redis/hlen", "redis/hkeys",
      "redis/hvals", "redis/hincrby",
      // List commands
      "redis/lpush", "redis/rpush", "redis/lpop", "redis/rpop",
      "redis/llen", "redis/lrange", "redis/lindex", "redis/lset",
      "redis/lrem", "redis/linsert",
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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/redis/5.4.1/index.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/redis/5.4.1/index.ts tests/plugins/redis/5.4.1/index.test.ts
git commit -m "feat(redis): add plugin index with types and AST builder for 35 commands (#52)"
```

---

### Task 2: Interpreter

**Files:**
- Create: `src/plugins/redis/5.4.1/interpreter.ts`
- Test: `tests/plugins/redis/5.4.1/interpreter.test.ts`

**Step 1: Write the failing interpreter tests**

Create `tests/plugins/redis/5.4.1/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { redis } from "../../../../src/plugins/redis/5.4.1";
import { redisInterpreter } from "../../../../src/plugins/redis/5.4.1/interpreter";

const app = ilo(num, str, redis({ host: "127.0.0.1", port: 6379 }));
const fragments = [redisInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "redis/command": async (effect) => {
      captured.push(effect);
      return "mock_result";
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// String commands
// ============================================================

describe("redis interpreter: get", () => {
  it("yields GET command", async () => {
    const prog = app(($) => $.redis.get("mykey"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("redis/command");
    expect(captured[0].command).toBe("GET");
    expect(captured[0].args).toEqual(["mykey"]);
  });
});

describe("redis interpreter: set", () => {
  it("yields SET command without flags", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["mykey", "myvalue"]);
  });

  it("yields SET command with EX and NX positional tokens", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EX", 60, "NX"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["mykey", "myvalue", "EX", 60, "NX"]);
  });

  it("yields SET command with PX token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "PX", 5000));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "PX", 5000]);
  });

  it("yields SET command with EXAT token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "EXAT", 1700000000));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "EXAT", 1700000000]);
  });

  it("yields SET command with KEEPTTL token", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "KEEPTTL"));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "KEEPTTL"]);
  });

  it("yields SET command with XX and GET tokens", async () => {
    const prog = app(($) => $.redis.set("mykey", "myvalue", "XX", "GET"));
    const { captured } = await run(prog);
    expect(captured[0].args).toEqual(["mykey", "myvalue", "XX", "GET"]);
  });
});

describe("redis interpreter: incr/decr", () => {
  it("yields INCR command", async () => {
    const prog = app(($) => $.redis.incr("counter"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("INCR");
    expect(captured[0].args).toEqual(["counter"]);
  });

  it("yields INCRBY command", async () => {
    const prog = app(($) => $.redis.incrby("counter", 5));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("INCRBY");
    expect(captured[0].args).toEqual(["counter", 5]);
  });

  it("yields DECR command", async () => {
    const prog = app(($) => $.redis.decr("counter"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DECR");
    expect(captured[0].args).toEqual(["counter"]);
  });

  it("yields DECRBY command", async () => {
    const prog = app(($) => $.redis.decrby("counter", 3));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DECRBY");
    expect(captured[0].args).toEqual(["counter", 3]);
  });
});

describe("redis interpreter: mget/mset", () => {
  it("yields MGET command", async () => {
    const prog = app(($) => $.redis.mget("k1", "k2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("MGET");
    expect(captured[0].args).toEqual(["k1", "k2"]);
  });

  it("yields MSET command", async () => {
    const prog = app(($) => $.redis.mset({ k1: "v1", k2: "v2" }));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("MSET");
    expect(captured[0].args).toEqual(["k1", "v1", "k2", "v2"]);
  });
});

describe("redis interpreter: append/getrange/setrange", () => {
  it("yields APPEND command", async () => {
    const prog = app(($) => $.redis.append("mykey", "extra"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("APPEND");
    expect(captured[0].args).toEqual(["mykey", "extra"]);
  });

  it("yields GETRANGE command", async () => {
    const prog = app(($) => $.redis.getrange("mykey", 0, 5));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("GETRANGE");
    expect(captured[0].args).toEqual(["mykey", 0, 5]);
  });

  it("yields SETRANGE command", async () => {
    const prog = app(($) => $.redis.setrange("mykey", 3, "abc"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("SETRANGE");
    expect(captured[0].args).toEqual(["mykey", 3, "abc"]);
  });
});

// ============================================================
// Key commands
// ============================================================

describe("redis interpreter: key commands", () => {
  it("yields DEL command", async () => {
    const prog = app(($) => $.redis.del("k1", "k2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("DEL");
    expect(captured[0].args).toEqual(["k1", "k2"]);
  });

  it("yields EXISTS command", async () => {
    const prog = app(($) => $.redis.exists("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("EXISTS");
    expect(captured[0].args).toEqual(["mykey"]);
  });

  it("yields EXPIRE command", async () => {
    const prog = app(($) => $.redis.expire("mykey", 300));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("EXPIRE");
    expect(captured[0].args).toEqual(["mykey", 300]);
  });

  it("yields PEXPIRE command", async () => {
    const prog = app(($) => $.redis.pexpire("mykey", 5000));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("PEXPIRE");
    expect(captured[0].args).toEqual(["mykey", 5000]);
  });

  it("yields TTL command", async () => {
    const prog = app(($) => $.redis.ttl("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("TTL");
    expect(captured[0].args).toEqual(["mykey"]);
  });

  it("yields PTTL command", async () => {
    const prog = app(($) => $.redis.pttl("mykey"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("PTTL");
    expect(captured[0].args).toEqual(["mykey"]);
  });
});

// ============================================================
// Hash commands
// ============================================================

describe("redis interpreter: hash commands", () => {
  it("yields HGET command", async () => {
    const prog = app(($) => $.redis.hget("myhash", "field1"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HGET");
    expect(captured[0].args).toEqual(["myhash", "field1"]);
  });

  it("yields HSET command", async () => {
    const prog = app(($) => $.redis.hset("myhash", { f1: "v1", f2: "v2" }));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HSET");
    expect(captured[0].args).toEqual(["myhash", "f1", "v1", "f2", "v2"]);
  });

  it("yields HMGET command", async () => {
    const prog = app(($) => $.redis.hmget("myhash", "f1", "f2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HMGET");
    expect(captured[0].args).toEqual(["myhash", "f1", "f2"]);
  });

  it("yields HGETALL command", async () => {
    const prog = app(($) => $.redis.hgetall("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HGETALL");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HDEL command", async () => {
    const prog = app(($) => $.redis.hdel("myhash", "f1", "f2"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HDEL");
    expect(captured[0].args).toEqual(["myhash", "f1", "f2"]);
  });

  it("yields HEXISTS command", async () => {
    const prog = app(($) => $.redis.hexists("myhash", "field1"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HEXISTS");
    expect(captured[0].args).toEqual(["myhash", "field1"]);
  });

  it("yields HLEN command", async () => {
    const prog = app(($) => $.redis.hlen("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HLEN");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HKEYS command", async () => {
    const prog = app(($) => $.redis.hkeys("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HKEYS");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HVALS command", async () => {
    const prog = app(($) => $.redis.hvals("myhash"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HVALS");
    expect(captured[0].args).toEqual(["myhash"]);
  });

  it("yields HINCRBY command", async () => {
    const prog = app(($) => $.redis.hincrby("myhash", "counter", 10));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("HINCRBY");
    expect(captured[0].args).toEqual(["myhash", "counter", 10]);
  });
});

// ============================================================
// List commands
// ============================================================

describe("redis interpreter: list commands", () => {
  it("yields LPUSH command", async () => {
    const prog = app(($) => $.redis.lpush("mylist", "a", "b"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPUSH");
    expect(captured[0].args).toEqual(["mylist", "a", "b"]);
  });

  it("yields RPUSH command", async () => {
    const prog = app(($) => $.redis.rpush("mylist", "c"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("RPUSH");
    expect(captured[0].args).toEqual(["mylist", "c"]);
  });

  it("yields LPOP command without count", async () => {
    const prog = app(($) => $.redis.lpop("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPOP");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LPOP command with count", async () => {
    const prog = app(($) => $.redis.lpop("mylist", 3));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LPOP");
    expect(captured[0].args).toEqual(["mylist", 3]);
  });

  it("yields RPOP command", async () => {
    const prog = app(($) => $.redis.rpop("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("RPOP");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LLEN command", async () => {
    const prog = app(($) => $.redis.llen("mylist"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LLEN");
    expect(captured[0].args).toEqual(["mylist"]);
  });

  it("yields LRANGE command", async () => {
    const prog = app(($) => $.redis.lrange("mylist", 0, -1));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LRANGE");
    expect(captured[0].args).toEqual(["mylist", 0, -1]);
  });

  it("yields LINDEX command", async () => {
    const prog = app(($) => $.redis.lindex("mylist", 2));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LINDEX");
    expect(captured[0].args).toEqual(["mylist", 2]);
  });

  it("yields LSET command", async () => {
    const prog = app(($) => $.redis.lset("mylist", 0, "newval"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LSET");
    expect(captured[0].args).toEqual(["mylist", 0, "newval"]);
  });

  it("yields LREM command", async () => {
    const prog = app(($) => $.redis.lrem("mylist", 2, "val"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LREM");
    expect(captured[0].args).toEqual(["mylist", 2, "val"]);
  });

  it("yields LINSERT command", async () => {
    const prog = app(($) => $.redis.linsert("mylist", "BEFORE", "pivot", "elem"));
    const { captured } = await run(prog);
    expect(captured[0].command).toBe("LINSERT");
    expect(captured[0].args).toEqual(["mylist", "BEFORE", "pivot", "elem"]);
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("redis interpreter: input resolution", () => {
  it("resolves input key for get", async () => {
    const prog = app({ key: "string" }, ($) => $.redis.get($.input.key));
    const { captured } = await run(prog, { key: "dynamic_key" });
    expect(captured[0].command).toBe("GET");
    expect(captured[0].args).toEqual(["dynamic_key"]);
  });

  it("resolves input params for set", async () => {
    const prog = app({ key: "string", value: "string" }, ($) =>
      $.redis.set($.input.key, $.input.value),
    );
    const { captured } = await run(prog, { key: "dk", value: "dv" });
    expect(captured[0].command).toBe("SET");
    expect(captured[0].args).toEqual(["dk", "dv"]);
  });
});

// ============================================================
// Return value
// ============================================================

describe("redis interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.redis.get("mykey"));
    const { result } = await run(prog);
    expect(result).toBe("mock_result");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plugins/redis/5.4.1/interpreter.test.ts`
Expected: FAIL — cannot find module `interpreter`

**Step 3: Write the interpreter**

Create `src/plugins/redis/5.4.1/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

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

/**
 * Generator-based interpreter fragment for redis plugin nodes.
 *
 * Yields `redis/command` effects for all 35 operations. Each effect
 * contains the Redis command name and a flat args array matching
 * the Redis protocol.
 */
export const redisInterpreter: InterpreterFragment = {
  pluginName: "redis",
  canHandle: (node) => node.kind.startsWith("redis/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- String commands ----

      case "redis/get": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "GET", args: [key] };
      }

      case "redis/set": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        const extra: unknown[] = [];
        for (const a of (node.args as ASTNode[]) || []) {
          extra.push(yield { type: "recurse", child: a });
        }
        return yield { type: "redis/command", command: "SET", args: [key, value, ...extra] };
      }

      case "redis/incr": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "INCR", args: [key] };
      }

      case "redis/incrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const increment = yield { type: "recurse", child: node.increment as ASTNode };
        return yield { type: "redis/command", command: "INCRBY", args: [key, increment] };
      }

      case "redis/decr": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "DECR", args: [key] };
      }

      case "redis/decrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const decrement = yield { type: "recurse", child: node.decrement as ASTNode };
        return yield { type: "redis/command", command: "DECRBY", args: [key, decrement] };
      }

      case "redis/mget": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "MGET", args: keys };
      }

      case "redis/mset": {
        const mapping = (yield { type: "recurse", child: node.mapping as ASTNode }) as Record<string, unknown>;
        return yield { type: "redis/command", command: "MSET", args: flattenRecord(mapping) };
      }

      case "redis/append": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        return yield { type: "redis/command", command: "APPEND", args: [key, value] };
      }

      case "redis/getrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const start = yield { type: "recurse", child: node.start as ASTNode };
        const end = yield { type: "recurse", child: node.end as ASTNode };
        return yield { type: "redis/command", command: "GETRANGE", args: [key, start, end] };
      }

      case "redis/setrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const offset = yield { type: "recurse", child: node.offset as ASTNode };
        const value = yield { type: "recurse", child: node.value as ASTNode };
        return yield { type: "redis/command", command: "SETRANGE", args: [key, offset, value] };
      }

      // ---- Key commands ----

      case "redis/del": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "DEL", args: keys };
      }

      case "redis/exists": {
        const keys: unknown[] = [];
        for (const k of node.keys as ASTNode[]) {
          keys.push(yield { type: "recurse", child: k });
        }
        return yield { type: "redis/command", command: "EXISTS", args: keys };
      }

      case "redis/expire": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const seconds = yield { type: "recurse", child: node.seconds as ASTNode };
        return yield { type: "redis/command", command: "EXPIRE", args: [key, seconds] };
      }

      case "redis/pexpire": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const ms = yield { type: "recurse", child: node.milliseconds as ASTNode };
        return yield { type: "redis/command", command: "PEXPIRE", args: [key, ms] };
      }

      case "redis/ttl": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "TTL", args: [key] };
      }

      case "redis/pttl": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "PTTL", args: [key] };
      }

      // ---- Hash commands ----

      case "redis/hget": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        return yield { type: "redis/command", command: "HGET", args: [key, field] };
      }

      case "redis/hset": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const mapping = (yield { type: "recurse", child: node.mapping as ASTNode }) as Record<string, unknown>;
        return yield { type: "redis/command", command: "HSET", args: [key, ...flattenRecord(mapping)] };
      }

      case "redis/hmget": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const fields: unknown[] = [];
        for (const f of node.fields as ASTNode[]) {
          fields.push(yield { type: "recurse", child: f });
        }
        return yield { type: "redis/command", command: "HMGET", args: [key, ...fields] };
      }

      case "redis/hgetall": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HGETALL", args: [key] };
      }

      case "redis/hdel": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const fields: unknown[] = [];
        for (const f of node.fields as ASTNode[]) {
          fields.push(yield { type: "recurse", child: f });
        }
        return yield { type: "redis/command", command: "HDEL", args: [key, ...fields] };
      }

      case "redis/hexists": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        return yield { type: "redis/command", command: "HEXISTS", args: [key, field] };
      }

      case "redis/hlen": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HLEN", args: [key] };
      }

      case "redis/hkeys": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HKEYS", args: [key] };
      }

      case "redis/hvals": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "HVALS", args: [key] };
      }

      case "redis/hincrby": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const field = yield { type: "recurse", child: node.field as ASTNode };
        const increment = yield { type: "recurse", child: node.increment as ASTNode };
        return yield { type: "redis/command", command: "HINCRBY", args: [key, field, increment] };
      }

      // ---- List commands ----

      case "redis/lpush": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const elements: unknown[] = [];
        for (const e of node.elements as ASTNode[]) {
          elements.push(yield { type: "recurse", child: e });
        }
        return yield { type: "redis/command", command: "LPUSH", args: [key, ...elements] };
      }

      case "redis/rpush": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const elements: unknown[] = [];
        for (const e of node.elements as ASTNode[]) {
          elements.push(yield { type: "recurse", child: e });
        }
        return yield { type: "redis/command", command: "RPUSH", args: [key, ...elements] };
      }

      case "redis/lpop": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const args: unknown[] = [key];
        if (node.count != null) {
          args.push(yield { type: "recurse", child: node.count as ASTNode });
        }
        return yield { type: "redis/command", command: "LPOP", args };
      }

      case "redis/rpop": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const args: unknown[] = [key];
        if (node.count != null) {
          args.push(yield { type: "recurse", child: node.count as ASTNode });
        }
        return yield { type: "redis/command", command: "RPOP", args };
      }

      case "redis/llen": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        return yield { type: "redis/command", command: "LLEN", args: [key] };
      }

      case "redis/lrange": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const start = yield { type: "recurse", child: node.start as ASTNode };
        const stop = yield { type: "recurse", child: node.stop as ASTNode };
        return yield { type: "redis/command", command: "LRANGE", args: [key, start, stop] };
      }

      case "redis/lindex": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const index = yield { type: "recurse", child: node.index as ASTNode };
        return yield { type: "redis/command", command: "LINDEX", args: [key, index] };
      }

      case "redis/lset": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const index = yield { type: "recurse", child: node.index as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield { type: "redis/command", command: "LSET", args: [key, index, element] };
      }

      case "redis/lrem": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const count = yield { type: "recurse", child: node.count as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield { type: "redis/command", command: "LREM", args: [key, count, element] };
      }

      case "redis/linsert": {
        const key = yield { type: "recurse", child: node.key as ASTNode };
        const pivot = yield { type: "recurse", child: node.pivot as ASTNode };
        const element = yield { type: "recurse", child: node.element as ASTNode };
        return yield {
          type: "redis/command",
          command: "LINSERT",
          args: [key, node.position as string, pivot, element],
        };
      }

      default:
        throw new Error(`Redis interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/redis/5.4.1/interpreter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/redis/5.4.1/interpreter.ts tests/plugins/redis/5.4.1/interpreter.test.ts
git commit -m "feat(redis): add interpreter with redis/command effects for 35 commands (#52)"
```

---

### Task 3: Server handler, client handler, SDK adapter

**Files:**
- Create: `src/plugins/redis/5.4.1/handler.server.ts`
- Create: `src/plugins/redis/5.4.1/handler.client.ts`
- Create: `src/plugins/redis/5.4.1/client-ioredis.ts`

**Step 1: Write handler.server.ts**

Create `src/plugins/redis/5.4.1/handler.server.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { RedisClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Redis effects
 * against a real Redis client.
 *
 * Handles `redis/command` effects by delegating to
 * `client.command(command, ...args)`. Throws on unhandled effect types.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: RedisClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "redis/command") {
      const { command, args } = effect as {
        type: "redis/command";
        command: string;
        args: unknown[];
      };
      const value = await client.command(command, ...args);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Redis client using the provided interpreter fragments.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: RedisClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Write handler.client.ts**

Create `src/plugins/redis/5.4.1/handler.client.ts`:

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends effects as JSON
 * to a remote server endpoint for execution.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 3: Write client-ioredis.ts**

Create `src/plugins/redis/5.4.1/client-ioredis.ts`:

```ts
import type { RedisClient } from "./interpreter";

/**
 * Wraps an ioredis instance into a {@link RedisClient}.
 *
 * Uses `redis.call()` to send raw commands, preserving the ioredis
 * instance's connection, authentication, and retry logic.
 *
 * @param redis - A configured ioredis `Redis` instance (or compatible).
 *   Must have a `call(command, ...args)` method.
 * @returns A {@link RedisClient} adapter.
 */
export function wrapIoredis(redis: { call(command: string, ...args: unknown[]): Promise<unknown> }): RedisClient {
  return {
    async command(command: string, ...args: unknown[]): Promise<unknown> {
      return redis.call(command, ...args);
    },
  };
}
```

**Step 4: Run type-check to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/plugins/redis/5.4.1/handler.server.ts src/plugins/redis/5.4.1/handler.client.ts src/plugins/redis/5.4.1/client-ioredis.ts
git commit -m "feat(redis): add server/client handlers and ioredis adapter (#52)"
```

---

### Task 4: Public exports

**Files:**
- Modify: `src/index.ts` (add redis exports after stripe exports)

**Step 1: Add redis exports to src/index.ts**

Add the following after the stripe exports block (after line 93):

```ts
export type { RedisConfig, RedisMethods } from "./plugins/redis/5.4.1";
export { redis } from "./plugins/redis/5.4.1";
export { wrapIoredis } from "./plugins/redis/5.4.1/client-ioredis";
export type {
  ClientHandlerOptions as RedisClientHandlerOptions,
  ClientHandlerState as RedisClientHandlerState,
} from "./plugins/redis/5.4.1/handler.client";
export { clientHandler as redisClientHandler } from "./plugins/redis/5.4.1/handler.client";
export {
  serverEvaluate as redisServerEvaluate,
  serverHandler as redisServerHandler,
} from "./plugins/redis/5.4.1/handler.server";
export type { RedisClient } from "./plugins/redis/5.4.1/interpreter";
export { redisInterpreter } from "./plugins/redis/5.4.1/interpreter";
```

**Step 2: Run full validation**

Run: `npm run build && npm run check && npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(redis): add public exports for redis plugin (#52)"
```

---

### Task 5: Final validation and cleanup

**Step 1: Run full test suite**

Run: `npm run build && npm run check && npm test`
Expected: All tests pass, no type errors, no lint errors.

**Step 2: Verify all node kinds are listed**

Manually count: 35 node kinds in `nodeKinds` array matches 35 switch cases in interpreter.

**Step 3: Final commit if any cleanup needed**

Only commit if there were issues found in step 1-2.
