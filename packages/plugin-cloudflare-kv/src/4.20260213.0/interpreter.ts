import type { Interpreter, RuntimeEntry } from "@mvfm/core";

/**
 * Cloudflare KV client interface consumed by the handler.
 *
 * Abstracts over the actual KVNamespace binding so handlers
 * can be tested with mock clients.
 */
export interface CloudflareKvClient {
  /** Get a text value by key. */
  get(key: string): Promise<string | null>;
  /** Get a JSON-parsed value by key. */
  getJson<T = unknown>(key: string): Promise<T | null>;
  /** Store a string value at key with optional options. */
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  /** Delete a key. */
  delete(key: string): Promise<void>;
  /** List keys with optional filtering/pagination. */
  list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

/**
 * Creates an interpreter for `cloudflare-kv/*` node kinds using the
 * RuntimeEntry + positional yield pattern.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns An Interpreter handling all cloudflare-kv node kinds.
 */
export function createCloudflareKvInterpreter(client: CloudflareKvClient): Interpreter {
  return {
    "cloudflare-kv/get": async function* (_entry: RuntimeEntry) {
      const key = (yield 0) as string;
      return await client.get(key);
    },

    "cloudflare-kv/get_json": async function* (_entry: RuntimeEntry) {
      const key = (yield 0) as string;
      return await client.getJson(key);
    },

    "cloudflare-kv/put": async function* (entry: RuntimeEntry) {
      const key = (yield 0) as string;
      const value = (yield 1) as string;
      const options =
        entry.children.length > 2
          ? ((yield 2) as {
              expiration?: number;
              expirationTtl?: number;
              metadata?: unknown;
            })
          : undefined;
      await client.put(key, value, options);
      return undefined;
    },

    "cloudflare-kv/delete": async function* (_entry: RuntimeEntry) {
      const key = (yield 0) as string;
      await client.delete(key);
      return undefined;
    },

    "cloudflare-kv/list": async function* (entry: RuntimeEntry) {
      const options =
        entry.children.length > 0
          ? ((yield 0) as { limit?: number; prefix?: string; cursor?: string })
          : undefined;
      return await client.list(options);
    },

    "cloudflare-kv/record": async function* (entry: RuntimeEntry) {
      const result: Record<string, unknown> = {};
      for (let i = 0; i < entry.children.length; i += 2) {
        const key = (yield i) as string;
        const value = yield i + 1;
        result[key] = value;
      }
      return result;
    },

    "cloudflare-kv/array": async function* (entry: RuntimeEntry) {
      const result: unknown[] = [];
      for (let i = 0; i < entry.children.length; i++) {
        result.push(yield i);
      }
      return result;
    },
  };
}
