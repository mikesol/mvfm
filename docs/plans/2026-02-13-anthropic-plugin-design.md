# Anthropic Plugin Design

**Date:** 2026-02-13
**Status:** Approved
**Issue:** #50
**Parent:** #46

## Goal

Implement the `anthropic` plugin wrapping `@anthropic-ai/sdk@0.74.0`. This is an external-service plugin following the stripe pattern: configured factory function, uniform effect type, all request-response operations.

## Source-level analysis

Analyzed from npm package `@anthropic-ai/sdk@0.74.0` (extracted and read source at `/tmp/anthropic-sdk-0.74.0/src/`).

### Top-level resources

The Anthropic client exposes 4 top-level resources:

- `completions` — Legacy text completions (deprecated)
- `messages` — Core Messages API + sub-resources
- `models` — Model information
- `beta` — Beta features (files, skills)

### Assessment matrix

| Operation | Category | Reason |
|-----------|----------|--------|
| `messages.create()` (non-streaming) | Maps cleanly | POST /v1/messages — pure request-response |
| `messages.countTokens()` | Maps cleanly | POST /v1/messages/count_tokens — pure request-response |
| `messages.batches.create()` | Maps cleanly | POST /v1/messages/batches — request-response |
| `messages.batches.retrieve()` | Maps cleanly | GET /v1/messages/batches/{id} — request-response |
| `messages.batches.list()` | Maps cleanly | GET /v1/messages/batches — request-response (1 page) |
| `messages.batches.delete()` | Maps cleanly | DELETE /v1/messages/batches/{id} — request-response |
| `messages.batches.cancel()` | Maps cleanly | POST /v1/messages/batches/{id}/cancel — request-response |
| `models.retrieve()` | Maps cleanly | GET /v1/models/{id} — request-response |
| `models.list()` | Maps cleanly | GET /v1/models — request-response (1 page) |
| `messages.create()` (streaming) | Can't model | Server-sent events / async iterator |
| `messages.stream()` | Can't model | Streaming wrapper over create() |
| `messages.parse()` | Needs deviation | Client-side Zod wrapper, not an API operation |
| `messages.batches.results()` | Can't model | Streams JSONL — async iterator |
| `completions.create()` | Needs deviation | Legacy, deprecated |
| `beta.*` | Needs deviation | Unstable surface, skip |

### Plugin sizing

**SMALL** — 9 modelable operations. Fully implemented in one pass.

## Architecture

### Plugin type

External-service, configured factory function (like stripe). Uniform effect: single `anthropic/api_call` effect type.

### Version directory

`src/plugins/anthropic/0.74.0/`

### Files

```
src/plugins/anthropic/0.74.0/
  index.ts               # PluginDefinition + AnthropicConfig + AnthropicMethods
  interpreter.ts         # InterpreterFragment + AnthropicClient interface
  handler.server.ts      # serverHandler + serverEvaluate
  handler.client.ts      # clientHandler
  client-anthropic-sdk.ts  # wrapAnthropicSdk adapter

tests/plugins/anthropic/0.74.0/
  index.test.ts          # AST construction tests
  interpreter.test.ts    # Effect-yielding tests with mock handlers
  integration.test.ts    # Real SDK tests (requires API key)
```

### Node kinds

| Node kind | HTTP | Path |
|-----------|------|------|
| `anthropic/create_message` | POST | `/v1/messages` |
| `anthropic/count_tokens` | POST | `/v1/messages/count_tokens` |
| `anthropic/create_message_batch` | POST | `/v1/messages/batches` |
| `anthropic/retrieve_message_batch` | GET | `/v1/messages/batches/{id}` |
| `anthropic/list_message_batches` | GET | `/v1/messages/batches` |
| `anthropic/delete_message_batch` | DELETE | `/v1/messages/batches/{id}` |
| `anthropic/cancel_message_batch` | POST | `/v1/messages/batches/{id}/cancel` |
| `anthropic/retrieve_model` | GET | `/v1/models/{id}` |
| `anthropic/list_models` | GET | `/v1/models` |

### DSL API

```ts
// Messages
$.anthropic.messages.create({ model: "claude-sonnet-4-5-20250929", max_tokens: 1024, messages: [...] })
$.anthropic.messages.countTokens({ model: "claude-sonnet-4-5-20250929", messages: [...] })

// Batches
$.anthropic.messages.batches.create({ requests: [...] })
$.anthropic.messages.batches.retrieve("batch_id")
$.anthropic.messages.batches.list({ limit: 20 })
$.anthropic.messages.batches.delete("batch_id")
$.anthropic.messages.batches.cancel("batch_id")

// Models
$.anthropic.models.retrieve("claude-sonnet-4-5-20250929")
$.anthropic.models.list()
```

### Config

```ts
interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
}
```

### Effect type

All operations yield a single `anthropic/api_call` effect:

```ts
{
  type: "anthropic/api_call",
  method: "POST" | "GET" | "DELETE",
  path: string,
  params?: Record<string, unknown>  // body for POST, query for GET
}
```

### SDK adapter

The `AnthropicClient` interface:

```ts
interface AnthropicClient {
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}
```

The adapter wraps the real Anthropic SDK instance. POST requests send params as body. GET requests encode params as query string. DELETE requests have no params.

### Honest assessment

**Works great:** messages.create (non-streaming), countTokens, all batch CRUD, model info — all pure request-response, nearly identical to real SDK.

**Works but different:** Return types use `Record<string, unknown>` instead of typed `Message`, `MessageTokensCount`, etc. Property access works via proxy but no IDE autocomplete.

**Doesn't work:** Streaming, structured output parsing (client-side Zod), batch result streaming, legacy completions, beta features.
