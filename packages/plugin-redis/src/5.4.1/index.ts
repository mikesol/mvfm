// ============================================================
// MVFM PLUGIN: redis (ioredis 5.4.1 compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// NO defaultInterpreter — requires createRedisInterpreter(client).
// ============================================================

import type { KindSpec, Plugin } from "@mvfm/core";
import { buildRedisApi } from "./build-methods";
import type { RedisConfig } from "./types";
import { parseRedisUrl } from "./types";

export type { RedisConfig } from "./types";

// ---- Plugin factory ---------------------------------------

/**
 * Creates the redis plugin definition (unified Plugin type).
 *
 * This plugin has NO defaultInterpreter. You must provide one
 * via `defaults(plugins, { redis: createRedisInterpreter(client) })`.
 *
 * @param config - A {@link RedisConfig} object or Redis URL string.
 *   Config is captured by the interpreter, not stored on AST nodes.
 * @returns A unified Plugin that contributes `$.redis`.
 *
 * @example
 * ```ts
 * const plugin = redis({ host: "127.0.0.1" });
 * const $ = composeDollar(numPlugin, strPlugin, plugin);
 * const expr = $.redis.get("mykey");
 * const nexpr = app(expr);
 * const interp = defaults([numPlugin, strPlugin, plugin], {
 *   redis: createRedisInterpreter(myClient),
 * });
 * const result = await fold(nexpr, interp);
 * ```
 */
export function redis(config?: RedisConfig | string) {
  // Resolve config but don't store on nodes — interpreter captures it
  const _resolvedConfig: RedisConfig =
    typeof config === "string"
      ? parseRedisUrl(config)
      : { host: "127.0.0.1", port: 6379, db: 0, ...config };

  return {
    name: "redis" as const,
    ctors: { redis: buildRedisApi() },
    kinds: {
      // String commands
      "redis/get": { inputs: [""] as [string], output: null as string | null } as KindSpec<
        [string],
        string | null
      >,
      "redis/set": { inputs: ["", ""] as [string, string], output: "" as string } as KindSpec<
        [string, string],
        string
      >,
      "redis/incr": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      "redis/incrby": { inputs: ["", 0] as [string, number], output: 0 as number } as KindSpec<
        [string, number],
        number
      >,
      "redis/decr": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      "redis/decrby": { inputs: ["", 0] as [string, number], output: 0 as number } as KindSpec<
        [string, number],
        number
      >,
      "redis/mget": { inputs: [] as string[], output: [] as (string | null)[] } as KindSpec<
        string[],
        (string | null)[]
      >,
      "redis/mset": { inputs: [] as string[], output: "" as string } as KindSpec<string[], string>,
      "redis/append": { inputs: ["", ""] as [string, string], output: 0 as number } as KindSpec<
        [string, string],
        number
      >,
      "redis/getrange": {
        inputs: ["", 0, 0] as [string, number, number],
        output: "" as string,
      } as KindSpec<[string, number, number], string>,
      "redis/setrange": {
        inputs: ["", 0, ""] as [string, number, string],
        output: 0 as number,
      } as KindSpec<[string, number, string], number>,
      // Key commands
      "redis/del": { inputs: [] as string[], output: 0 as number } as KindSpec<string[], number>,
      "redis/exists": { inputs: [] as string[], output: 0 as number } as KindSpec<string[], number>,
      "redis/expire": { inputs: ["", 0] as [string, number], output: 0 as number } as KindSpec<
        [string, number],
        number
      >,
      "redis/pexpire": { inputs: ["", 0] as [string, number], output: 0 as number } as KindSpec<
        [string, number],
        number
      >,
      "redis/ttl": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      "redis/pttl": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      // Hash commands
      "redis/hget": {
        inputs: ["", ""] as [string, string],
        output: null as string | null,
      } as KindSpec<[string, string], string | null>,
      "redis/hset": {
        inputs: ["", ""] as [string, string, ...string[]],
        output: 0 as number,
      } as KindSpec<[string, string, ...string[]], number>,
      "redis/hmget": {
        inputs: [""] as [string, ...string[]],
        output: [] as (string | null)[],
      } as KindSpec<[string, ...string[]], (string | null)[]>,
      "redis/hgetall": {
        inputs: [""] as [string],
        output: {} as Record<string, string>,
      } as KindSpec<[string], Record<string, string>>,
      "redis/hdel": {
        inputs: [""] as [string, ...string[]],
        output: 0 as number,
      } as KindSpec<[string, ...string[]], number>,
      "redis/hexists": { inputs: ["", ""] as [string, string], output: 0 as number } as KindSpec<
        [string, string],
        number
      >,
      "redis/hlen": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      "redis/hkeys": { inputs: [""] as [string], output: [] as string[] } as KindSpec<
        [string],
        string[]
      >,
      "redis/hvals": { inputs: [""] as [string], output: [] as string[] } as KindSpec<
        [string],
        string[]
      >,
      "redis/hincrby": {
        inputs: ["", "", 0] as [string, string, number],
        output: 0 as number,
      } as KindSpec<[string, string, number], number>,
      // List commands
      "redis/lpush": {
        inputs: [""] as [string, ...string[]],
        output: 0 as number,
      } as KindSpec<[string, ...string[]], number>,
      "redis/rpush": {
        inputs: [""] as [string, ...string[]],
        output: 0 as number,
      } as KindSpec<[string, ...string[]], number>,
      "redis/lpop": { inputs: [""] as [string], output: null as string | null } as KindSpec<
        [string],
        string | null
      >,
      "redis/rpop": { inputs: [""] as [string], output: null as string | null } as KindSpec<
        [string],
        string | null
      >,
      "redis/llen": { inputs: [""] as [string], output: 0 as number } as KindSpec<[string], number>,
      "redis/lrange": {
        inputs: ["", 0, 0] as [string, number, number],
        output: [] as string[],
      } as KindSpec<[string, number, number], string[]>,
      "redis/lindex": {
        inputs: ["", 0] as [string, number],
        output: null as string | null,
      } as KindSpec<[string, number], string | null>,
      "redis/lset": {
        inputs: ["", 0, ""] as [string, number, string],
        output: "" as string,
      } as KindSpec<[string, number, string], string>,
      "redis/lrem": {
        inputs: ["", 0, ""] as [string, number, string],
        output: 0 as number,
      } as KindSpec<[string, number, string], number>,
      "redis/linsert": {
        inputs: ["", "", "", ""] as [string, string, string, string],
        output: 0 as number,
      } as KindSpec<[string, string, string, string], number>,
      // Structural helpers (produced by liftArg)
      "redis/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "redis/array": { inputs: [] as unknown[], output: [] as unknown[] } as KindSpec<
        unknown[],
        unknown[]
      >,
    },
    traits: {},
    lifts: {},
  } satisfies Plugin;
}

/**
 * Alias for {@link redis}, kept for readability at call sites.
 */
export const redisPlugin = redis;
