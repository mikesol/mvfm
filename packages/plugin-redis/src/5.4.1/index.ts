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

import type { KindSpec } from "@mvfm/core";
import { buildRedisApi } from "./build-methods";
import { REDIS_NODE_KINDS } from "./node-kinds";
import type { RedisConfig } from "./types";
import { parseRedisUrl } from "./types";

export type { RedisConfig, RedisMethods } from "./types";

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<unknown[], unknown>> {
  const kinds: Record<string, KindSpec<unknown[], unknown>> = {};
  for (const kind of REDIS_NODE_KINDS) {
    kinds[kind] = {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>;
  }
  return kinds;
}

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
 * const $ = mvfmU(numPluginU, strPluginU, plugin);
 * const expr = $.redis.get("mykey");
 * const nexpr = app(expr);
 * const interp = defaults([numPluginU, strPluginU, plugin], {
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
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    nodeKinds: [...REDIS_NODE_KINDS],
  };
}

/**
 * Alias for {@link redis}, kept for readability at call sites.
 */
export const redisPlugin = redis;
