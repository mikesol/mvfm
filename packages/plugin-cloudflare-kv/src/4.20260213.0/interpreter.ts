import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

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

interface KvNode extends TypedNode<unknown> {
  kind: string;
  key?: TypedNode<string>;
  value?: TypedNode<string>;
  options?: TypedNode;
  config: { namespaceId: string };
}

/**
 * Creates an interpreter for `cloudflare-kv/*` node kinds.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns An Interpreter handling all cloudflare-kv node kinds.
 */
export function createCloudflareKvInterpreter(client: CloudflareKvClient): Interpreter {
  return {
    "cloudflare-kv/get": async function* (node: KvNode) {
      const key = yield* eval_(node.key!);
      return await client.get(key);
    },

    "cloudflare-kv/get_json": async function* (node: KvNode) {
      const key = yield* eval_(node.key!);
      return await client.getJson(key);
    },

    "cloudflare-kv/put": async function* (node: KvNode) {
      const key = yield* eval_(node.key!);
      const value = yield* eval_(node.value!);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      await client.put(key, value, options as any);
      return undefined;
    },

    "cloudflare-kv/delete": async function* (node: KvNode) {
      const key = yield* eval_(node.key!);
      await client.delete(key);
      return undefined;
    },

    "cloudflare-kv/list": async function* (node: KvNode) {
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.list(options as any);
    },
  };
}
