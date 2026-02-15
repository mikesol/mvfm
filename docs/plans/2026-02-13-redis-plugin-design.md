# Redis (ioredis) Plugin Design

**Issue:** #52
**Parent:** #46
**ioredis version:** 5.4.1
**Plugin size:** LARGE (200+ commands) — Pass 1 of 60/30/10 split
**Pass 1 scope:** Core KV + expiry + hashes + lists (35 commands)

## Source-Level Analysis

Analyzed ioredis 5.4.1 source at `lib/utils/RedisCommander.ts`. Key findings:

- Every command has callback overloads (irrelevant for Mvfm AST)
- Every string command has `*Buffer` variants (irrelevant — Mvfm doesn't model binary)
- SET has 100+ overloads for positional string tokens (EX, PX, NX, XX, KEEPTTL, GET)
- Variadic commands (DEL, MGET, LPUSH, etc.) accept both spread and array forms
- Class hierarchy: `Redis extends Commander` with `RedisCommander<Context>` mixin

## Documented Deviations

| ioredis API | Mvfm API | Rationale |
|---|---|---|
| `mset(k1, v1, k2, v2)` | `mset({ k1: v1, k2: v2 })` | Object-only form for clean AST serialization (object form IS valid ioredis) |
| `hset(key, f1, v1, f2, v2)` | `hset(key, { f1: v1, f2: v2 })` | Same as MSET (object form IS valid ioredis) |
| `getBuffer()`, `hgetallBuffer()`, etc. | Not modeled | Buffer variants are runtime concerns, not AST-level |
| Callback overloads | Not modeled | Mvfm is AST-based, returns `Expr<T>` |

**SET matches ioredis exactly** — uses positional string tokens (`"EX"`, `"PX"`, `"NX"`, `"XX"`, `"KEEPTTL"`, `"GET"`) so LLMs trained on ioredis produce correct code with zero adaptation.

## Config

```ts
export interface RedisConfig {
  host?: string;        // default "127.0.0.1"
  port?: number;        // default 6379
  password?: string;
  db?: number;          // default 0
  username?: string;
  connectionName?: string;
  keyPrefix?: string;
}
```

Factory: `redis(config?: RedisConfig | string)` — string form is Redis URL.

## DSL API

```ts
export interface RedisMethods {
  redis: {
    // String commands (11)
    get(key): Expr<string | null>;
    set(key, value, ...args): Expr<string | null>;  // positional tokens: "EX", 60, "NX", etc.
    incr(key): Expr<number>;
    incrby(key, increment): Expr<number>;
    decr(key): Expr<number>;
    decrby(key, decrement): Expr<number>;
    mget(...keys): Expr<(string | null)[]>;
    mset(mapping): Expr<"OK">;
    append(key, value): Expr<number>;
    getrange(key, start, end): Expr<string>;
    setrange(key, offset, value): Expr<number>;

    // Key commands (6)
    del(...keys): Expr<number>;
    exists(...keys): Expr<number>;
    expire(key, seconds): Expr<number>;
    pexpire(key, milliseconds): Expr<number>;
    ttl(key): Expr<number>;
    pttl(key): Expr<number>;

    // Hash commands (10)
    hget(key, field): Expr<string | null>;
    hset(key, mapping): Expr<number>;
    hmget(key, ...fields): Expr<(string | null)[]>;
    hgetall(key): Expr<Record<string, string>>;
    hdel(key, ...fields): Expr<number>;
    hexists(key, field): Expr<number>;
    hlen(key): Expr<number>;
    hkeys(key): Expr<string[]>;
    hvals(key): Expr<string[]>;
    hincrby(key, field, increment): Expr<number>;

    // List commands (10)
    lpush(key, ...elements): Expr<number>;
    rpush(key, ...elements): Expr<number>;
    lpop(key, count?): Expr<string | null>;
    rpop(key, count?): Expr<string | null>;
    llen(key): Expr<number>;
    lrange(key, start, stop): Expr<string[]>;
    lindex(key, index): Expr<string | null>;
    lset(key, index, element): Expr<"OK">;
    lrem(key, count, element): Expr<number>;
    linsert(key, position, pivot, element): Expr<number>;
  };
}
```

All parameters accept `Expr<T> | T` and are lifted via `ctx.lift()`.

## AST Node Kinds (35 total)

```
redis/get, redis/set, redis/incr, redis/incrby, redis/decr, redis/decrby,
redis/mget, redis/mset, redis/append, redis/getrange, redis/setrange,
redis/del, redis/exists, redis/expire, redis/pexpire, redis/ttl, redis/pttl,
redis/hget, redis/hset, redis/hmget, redis/hgetall, redis/hdel, redis/hexists,
redis/hlen, redis/hkeys, redis/hvals, redis/hincrby,
redis/lpush, redis/rpush, redis/lpop, redis/rpop, redis/llen, redis/lrange,
redis/lindex, redis/lset, redis/lrem, redis/linsert
```

## Interpreter

Single effect type: `redis/command` with `{ command: string, args: unknown[] }`.

The interpreter resolves all `Expr` children via `recurse`, then yields a `redis/command` effect with the Redis command name and flattened args array.

```ts
export interface RedisClient {
  command(command: string, ...args: unknown[]): Promise<unknown>;
}
```

## Handler

- **Server handler**: Receives `redis/command` effects, dispatches to `RedisClient.command()`
- **Client handler**: HTTP proxy to `{baseUrl}/mvfm/execute` (same pattern as postgres/stripe)
- **SDK adapter** (`client-ioredis.ts`): Wraps ioredis instance via `redis.call(command, ...args)`

## File Structure

```
src/plugins/redis/5.4.1/
  index.ts              # Factory, types, build()
  interpreter.ts        # RedisClient, redisInterpreter
  handler.server.ts     # serverHandler, serverEvaluate
  handler.client.ts     # clientHandler
  client-ioredis.ts     # wrapIoredis()

tests/plugins/redis/5.4.1/
  index.test.ts         # AST construction (35 commands)
  interpreter.test.ts   # Effect yielding with mock handler
```

## Future Passes

- **Pass 2**: Transactions (MULTI/EXEC), streams (XADD/XRANGE), sets, sorted sets
- **Pass 3**: Pub/Sub (if modelable), Lua scripting, Geo, HyperLogLog, bit ops
