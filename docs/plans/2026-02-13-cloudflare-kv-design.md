# Cloudflare KV Plugin — Design

**Date:** 2026-02-13
**Issue:** #57
**Status:** Approved

## Source-Level Analysis

Analyzed `@cloudflare/workers-types@4.20260213.0` — the `KVNamespace` interface from `/latest/index.ts` (lines 2159-2272).

### Assessment Matrix

| Operation | Category | Notes |
|-----------|----------|-------|
| `get(key)` → string | Maps cleanly | Default text return |
| `get(key, "json")` → T | Maps cleanly | Parsed JSON return |
| `get(key, "text")` → string | Maps cleanly | Redundant with default, skip |
| `get(key, "arrayBuffer")` → ArrayBuffer | Can't model | Binary data, no AST representation |
| `get(key, "stream")` → ReadableStream | Can't model | Streaming, no request-response shape |
| `get(keys[])` (batch) | Needs deviation | Defer — batch operations add complexity |
| `put(key, value, options?)` → void | Maps cleanly | String values only (AB/Stream can't model) |
| `delete(key)` → void | Maps cleanly | Direct 1:1 |
| `list(options?)` → ListResult | Maps cleanly | Pagination via cursor |
| `getWithMetadata(key)` → {value, metadata} | Maps cleanly | Defer to pass 2 |

### Plugin Size

SMALL — 5 node kinds, 4 user-facing operations (get, put, delete, list). Fully implemented in one pass.

## Architecture

- **Plugin type:** External-service (versioned)
- **Directory:** `src/plugins/cloudflare-kv/4.20260213.0/`
- **Config:** `{ namespaceId: string }` baked into every AST node

### Files

```
src/plugins/cloudflare-kv/4.20260213.0/
  index.ts            # PluginDefinition + types
  interpreter.ts      # InterpreterFragment
  handler.server.ts   # StepHandler wrapping KVNamespace
  handler.client.ts   # HTTP proxy StepHandler
  client-cf-kv.ts     # Adapter: KVNamespace → CloudflareKvClient

tests/plugins/cloudflare-kv/4.20260213.0/
  index.test.ts       # AST construction tests
  interpreter.test.ts # Effect-yielding tests with mocks
```

No integration test in pass 1 (requires Cloudflare Workers runtime).

## API Surface

```ts
// Config
interface CloudflareKvConfig { namespaceId: string }

// Factory
function cloudflareKv(config: CloudflareKvConfig): PluginDefinition<CloudflareKvMethods>

// Methods on $
interface CloudflareKvMethods {
  kv: {
    get(key: Expr<string> | string): Expr<string | null>;
    get(key: Expr<string> | string, type: "text"): Expr<string | null>;
    get<T = unknown>(key: Expr<string> | string, type: "json"): Expr<T | null>;
    put(key: Expr<string> | string, value: Expr<string> | string, options?: Expr<KvPutOptions> | KvPutOptions): Expr<void>;
    delete(key: Expr<string> | string): Expr<void>;
    list(options?: Expr<KvListOptions> | KvListOptions): Expr<KvListResult>;
  }
}
```

### Supporting Types

```ts
interface KvPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: unknown;
}

interface KvListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
}

interface KvListResult {
  keys: Array<{ name: string; expiration?: number }>;
  list_complete: boolean;
  cursor?: string;
}
```

## Node Kinds (5)

| Kind | Fields | Description |
|------|--------|-------------|
| `cloudflare-kv/get` | `key`, `config` | Get text value |
| `cloudflare-kv/get_json` | `key`, `config` | Get JSON-parsed value |
| `cloudflare-kv/put` | `key`, `value`, `options?`, `config` | Store value |
| `cloudflare-kv/delete` | `key`, `config` | Delete key |
| `cloudflare-kv/list` | `options?`, `config` | List keys |

All `key`, `value`, `options` fields are `ASTNode` (lifted via `ctx.lift()`).

## Effect Types

```ts
type KvEffect =
  | { type: "kv_get"; key: string; returnType: "text" | "json"; namespaceId: string }
  | { type: "kv_put"; key: string; value: string; options?: KvPutOptions; namespaceId: string }
  | { type: "kv_delete"; key: string; namespaceId: string }
  | { type: "kv_list"; options?: KvListOptions; namespaceId: string }
```

## SDK Adapter

```ts
interface CloudflareKvClient {
  get(key: string): Promise<string | null>;
  getJson<T>(key: string): Promise<T | null>;
  put(key: string, value: string, options?: KvPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KvListOptions): Promise<KvListResult>;
}

function wrapKVNamespace(kv: KVNamespace): CloudflareKvClient
```

## Deferred (Pass 2)

- `getWithMetadata` — returns `{value, metadata, cacheStatus}`
- Batch `get(keys[])` — multi-key fetch
- `cacheTtl` option on get
- `metadata` on put options
- `arrayBuffer` / `stream` return types (may never model — binary/streaming)
