import type { Interpreter, TypedNode } from "@mvfm/core";
import { defineInterpreter, eval_ } from "@mvfm/core";

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

/** A `cloudflare-kv/get` node for text retrieval. */
export interface CloudflareKvGetNode extends TypedNode<string | null> {
  kind: "cloudflare-kv/get";
  key: TypedNode<string>;
  config: { namespaceId: string };
}

/** A `cloudflare-kv/get_json` node for JSON retrieval. */
export interface CloudflareKvGetJsonNode extends TypedNode<unknown | null> {
  kind: "cloudflare-kv/get_json";
  key: TypedNode<string>;
  config: { namespaceId: string };
}

/** A `cloudflare-kv/put` node for value writes. */
export interface CloudflareKvPutNode extends TypedNode<void> {
  kind: "cloudflare-kv/put";
  key: TypedNode<string>;
  value: TypedNode<string>;
  options?: TypedNode<unknown> | null;
  config: { namespaceId: string };
}

/** A `cloudflare-kv/delete` node for key deletion. */
export interface CloudflareKvDeleteNode extends TypedNode<void> {
  kind: "cloudflare-kv/delete";
  key: TypedNode<string>;
  config: { namespaceId: string };
}

/** A `cloudflare-kv/list` node for key listing. */
export interface CloudflareKvListNode
  extends TypedNode<{
    keys: Array<{ name: string; expiration?: number }>;
    list_complete: boolean;
    cursor?: string;
  }> {
  kind: "cloudflare-kv/list";
  options?: TypedNode<unknown> | null;
  config: { namespaceId: string };
}

type CloudflareKvKind =
  | "cloudflare-kv/get"
  | "cloudflare-kv/get_json"
  | "cloudflare-kv/put"
  | "cloudflare-kv/delete"
  | "cloudflare-kv/list";

declare module "@mvfm/core" {
  interface NodeTypeMap {
    "cloudflare-kv/get": CloudflareKvGetNode;
    "cloudflare-kv/get_json": CloudflareKvGetJsonNode;
    "cloudflare-kv/put": CloudflareKvPutNode;
    "cloudflare-kv/delete": CloudflareKvDeleteNode;
    "cloudflare-kv/list": CloudflareKvListNode;
  }
}

/**
 * Creates an interpreter for `cloudflare-kv/*` node kinds.
 *
 * @param client - The {@link CloudflareKvClient} to execute against.
 * @returns An Interpreter handling all cloudflare-kv node kinds.
 */
export function createCloudflareKvInterpreter(client: CloudflareKvClient): Interpreter {
  return defineInterpreter<CloudflareKvKind>()({
    "cloudflare-kv/get": async function* (node: CloudflareKvGetNode) {
      const key = yield* eval_(node.key);
      return await client.get(key);
    },

    "cloudflare-kv/get_json": async function* (node: CloudflareKvGetJsonNode) {
      const key = yield* eval_(node.key);
      return await client.getJson(key);
    },

    "cloudflare-kv/put": async function* (node: CloudflareKvPutNode) {
      const key = yield* eval_(node.key);
      const value = yield* eval_(node.value);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      await client.put(key, value, options as any);
      return undefined;
    },

    "cloudflare-kv/delete": async function* (node: CloudflareKvDeleteNode) {
      const key = yield* eval_(node.key);
      await client.delete(key);
      return undefined;
    },

    "cloudflare-kv/list": async function* (node: CloudflareKvListNode) {
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.list(options as any);
    },
  });
}
