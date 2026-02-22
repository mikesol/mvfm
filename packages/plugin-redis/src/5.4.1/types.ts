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
