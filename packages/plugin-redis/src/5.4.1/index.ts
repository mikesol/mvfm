import type { PluginDefinition } from "@mvfm/core";
import { buildRedisMethods } from "./build-methods";
import { REDIS_NODE_KINDS } from "./node-kinds";
import type { RedisConfig, RedisMethods } from "./types";
import { parseRedisUrl } from "./types";

export type { RedisConfig, RedisMethods } from "./types";

/**
 * Redis plugin factory. Namespace: `redis/`.
 *
 * Creates a plugin that exposes string, key, hash, and list
 * command methods for building parameterized Redis AST nodes.
 *
 * @param config - A {@link RedisConfig} object or Redis URL string.
 * @returns A PluginDefinition for the redis plugin.
 */
export function redis(config?: RedisConfig | string): PluginDefinition<RedisMethods> {
  const resolvedConfig: RedisConfig =
    typeof config === "string"
      ? parseRedisUrl(config)
      : { host: "127.0.0.1", port: 6379, db: 0, ...config };

  return {
    name: "redis",
    nodeKinds: [...REDIS_NODE_KINDS],
    build(ctx) {
      return buildRedisMethods(ctx, resolvedConfig);
    },
  };
}
