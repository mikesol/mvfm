import type { CloudflareKvClient } from "@mvfm/plugin-cloudflare-kv";

/**
 * In-memory implementation of {@link CloudflareKvClient} for the docs playground.
 *
 * Stores data in plain Maps, emulating Cloudflare KV get/put/delete/list
 * semantics. Not suitable for production use — designed for deterministic
 * doc examples that run entirely in the browser.
 */
export class MemoryCloudflareKvClient implements CloudflareKvClient {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async getJson<T = unknown>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  }

  async put(
    key: string,
    value: string,
    _options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    let keys = [...this.store.keys()].sort();
    if (options?.prefix) {
      keys = keys.filter((k) => k.startsWith(options.prefix!));
    }
    const startIdx = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const limit = options?.limit ?? 1000;
    const page = keys.slice(startIdx, startIdx + limit);
    const done = startIdx + limit >= keys.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: done,
      cursor: done ? undefined : String(startIdx + limit),
    };
  }
}
