# OpenAI Plugin Design

**Issue:** #48 (parent: #46)
**Date:** 2026-02-13
**SDK:** openai-node v6.21.0
**Plugin type:** External-service
**Plugin size:** SMALL — fully implemented in one pass (8 operations)

## Goal

Implement the `openai` plugin wrapping the [openai-node](https://github.com/openai/openai-node) SDK. Scoped to "AI text" operations: chat completions, embeddings, moderations, and legacy completions.

The API must hug the real openai-node SDK 1:1. An LLM trained on the real SDK should be able to write mvfm OpenAI programs with near-zero learning curve.

## API Surface

### Real openai-node

```ts
const openai = new OpenAI({ apiKey: "sk-..." });
await openai.chat.completions.create({ model: "gpt-4o", messages: [...] })
await openai.chat.completions.retrieve("cmpl_123")
await openai.chat.completions.list({ model: "gpt-4o" })
await openai.chat.completions.update("cmpl_123", { metadata: {...} })
await openai.chat.completions.delete("cmpl_123")
await openai.embeddings.create({ model: "text-embedding-3-small", input: "hello" })
await openai.moderations.create({ model: "omni-moderation-latest", input: "some text" })
await openai.completions.create({ model: "gpt-3.5-turbo-instruct", prompt: "Say hello" })
```

### Mvfm equivalent (1:1)

```ts
const app = mvfm(openai({ apiKey: "sk-..." }));
app(($) => {
  $.openai.chat.completions.create({ model: "gpt-4o", messages: [...] })
  $.openai.chat.completions.retrieve("cmpl_123")
  $.openai.chat.completions.list({ model: "gpt-4o" })
  $.openai.chat.completions.update("cmpl_123", { metadata: {...} })
  $.openai.chat.completions.delete("cmpl_123")
  $.openai.embeddings.create({ model: "text-embedding-3-small", input: "hello" })
  $.openai.moderations.create({ model: "omni-moderation-latest", input: "some text" })
  $.openai.completions.create({ model: "gpt-3.5-turbo-instruct", prompt: "Say hello" })
});
```

## Node Kinds (8)

| Node kind | HTTP | Path | Method signature |
|---|---|---|---|
| `openai/create_chat_completion` | POST | `/chat/completions` | `create(params)` |
| `openai/retrieve_chat_completion` | GET | `/chat/completions/{id}` | `retrieve(id)` |
| `openai/list_chat_completions` | GET | `/chat/completions` | `list(params?)` |
| `openai/update_chat_completion` | POST | `/chat/completions/{id}` | `update(id, params)` |
| `openai/delete_chat_completion` | DELETE | `/chat/completions/{id}` | `delete(id)` |
| `openai/create_embedding` | POST | `/embeddings` | `create(params)` |
| `openai/create_moderation` | POST | `/moderations` | `create(params)` |
| `openai/create_completion` | POST | `/completions` | `create(params)` |

## Configuration

```ts
export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  project?: string;
}
```

`apiKey` is required. `organization` and `project` are optional overrides (the SDK reads them from env vars by default, but mvfm bakes them into AST nodes). Runtime-only options (baseURL, timeout, maxRetries, fetch) belong in the SDK adapter / handler, not in the AST.

## Architecture

### Directory structure

```
src/plugins/openai/6.21.0/
  index.ts              # PluginDefinition + OpenAIMethods + OpenAIConfig
  interpreter.ts        # InterpreterFragment (const), yields openai/api_call
  handler.server.ts     # serverHandler(client) + serverEvaluate
  handler.client.ts     # clientHandler(options) — HTTP proxy
  client-openai-sdk.ts  # wrapOpenAISdk(openai) → OpenAIClient

tests/plugins/openai/6.21.0/
  index.test.ts         # AST construction tests
  interpreter.test.ts   # Effect-yielding tests with mock handler
  integration.test.ts   # Real SDK against lightweight HTTP mock server
```

### Effect type (uniform)

All operations yield a single effect type:

```ts
{
  type: "openai/api_call",
  method: "POST" | "GET" | "DELETE",
  path: string,
  body?: Record<string, unknown>
}
```

This mirrors the Stripe plugin pattern. Every OpenAI text operation is pure request-response — no scoping, no transactions, no stateful sessions. One effect type covers everything.

### OpenAIClient interface

```ts
export interface OpenAIClient {
  request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown>;
}
```

The SDK adapter (`client-openai-sdk.ts`) wraps the real `OpenAI` client into this interface. The server handler consumes only `OpenAIClient`, making it testable with mock clients.

### Interpreter

Const (not factory). Each node kind resolves its children via `recurse`, then yields one `openai/api_call` effect:

```ts
case "openai/create_chat_completion": {
  const body = yield { type: "recurse", child: node.params };
  return yield { type: "openai/api_call", method: "POST", path: "/chat/completions", body };
}
case "openai/retrieve_chat_completion": {
  const id = yield { type: "recurse", child: node.id };
  return yield { type: "openai/api_call", method: "GET", path: `/chat/completions/${id}` };
}
```

### Integration tests

Uses a lightweight HTTP server (Node.js `http.createServer`) that returns canned OpenAI-shaped responses. Spun up in `beforeAll`, torn down in `afterAll`. No Docker dependency needed — OpenAI's API is simpler than Stripe's and doesn't need a full mock server.

## Honest Assessment

Based on source-level analysis of openai-node v6.21.0 (cloned at `/tmp/openai-node`).

### Maps cleanly (implemented)

| Operation | Reason |
|---|---|
| `chat.completions.create()` (non-streaming) | POST /chat/completions, pure request-response |
| `chat.completions.retrieve(id)` | GET /chat/completions/{id} |
| `chat.completions.list()` | GET /chat/completions, returns first page |
| `chat.completions.update(id, body)` | POST /chat/completions/{id} |
| `chat.completions.delete(id)` | DELETE /chat/completions/{id} |
| `embeddings.create()` | POST /embeddings, pure request-response |
| `moderations.create()` | POST /moderations, pure request-response |
| `completions.create()` (non-streaming) | POST /completions, pure request-response (legacy) |

### Can't model (fundamental mismatch with AST)

| Feature | Reason |
|---|---|
| **Streaming** (`stream: true`) | Returns `Stream<ChatCompletionChunk>`, an async iterable. Push-based, no finite request-response shape. Omitted entirely from params. |
| **Auto-pagination** | `list()` returns `PagePromise` with cursor-based async iteration. First page is modelable; auto-iteration is not. Use `$.rec()` with `has_more`/`after` for manual pagination. |
| **Realtime API** | WebSocket-based, bidirectional push. Not request-response. |
| **File uploads** | `files.create()` takes `Uploadable` (binary stream). Binary upload is a runtime concern, not an AST shape. |

### Not modeled yet (could add incrementally)

| Feature | Notes |
|---|---|
| `RequestOptions` (2nd arg) | Idempotency keys, timeout overrides, custom headers. Could become optional AST field. |
| Typed response objects | Using `Record<string, unknown>` (like Stripe). Property access works via proxy. |
| Remaining 18+ resources | images, audio, fine-tuning, vector stores, batches, etc. Same pattern, just more switch cases. |
| Embeddings base64 auto-decode | SDK transparently requests base64 and decodes to Float32Array. This is an SDK-level optimization; our adapter passes through whatever the SDK returns. |

### Works but different from SDK

| Aspect | Real SDK | Mvfm |
|---|---|---|
| Sequencing | `await` chains | `$.do()` for explicit sequencing |
| Return types | `ChatCompletion`, `Embedding`, etc. (typed) | `Record<string, unknown>` (untyped, proxy access) |
| Error handling | `try/catch` with `APIError` subtypes | `$.attempt()` via error plugin |
| Pagination | `for await (const x of list())` | `$.rec()` with `has_more`/`after` |
