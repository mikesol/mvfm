# Issue 82: Align OpenAI Plugin Types to SDK

## Problem

OpenAI plugin uses `Record<string, unknown>` for all params and return types in `OpenAIMethods`, weakening type precision and losing IDE autocomplete.

## Scope

Replace `Record<string, unknown>` with openai-node SDK types in `OpenAIMethods` (public API in `index.ts` only). Internal interpreter types stay generic.

## Approach

Direct SDK type imports from `openai/resources/...`. The plugin is version-pinned to `src/6.21.0/`, so import path stability is not a concern.

## Type Mapping

| Method | Input Type | Output Type |
|--------|-----------|-------------|
| `chat.completions.create` | `ChatCompletionCreateParamsNonStreaming` | `ChatCompletion` |
| `chat.completions.retrieve` | `string` | `ChatCompletion` |
| `chat.completions.list` | `ChatCompletionListParams` | `ChatCompletionsPage` |
| `chat.completions.update` | `ChatCompletionUpdateParams` | `ChatCompletion` |
| `chat.completions.delete` | `string` | `ChatCompletionDeleted` |
| `embeddings.create` | `EmbeddingCreateParams` | `CreateEmbeddingResponse` |
| `moderations.create` | `ModerationCreateParams` | `ModerationCreateResponse` |
| `completions.create` | `CompletionCreateParamsNonStreaming` | `Completion` |

## Files Changed

- `packages/plugin-openai/src/6.21.0/index.ts` — add SDK type imports, replace all `Record<string, unknown>` in `OpenAIMethods`

## Files Unchanged

- `interpreter.ts` — internal types stay generic
- `client-openai-sdk.ts` — stays generic
- `handler.client.ts` / `handler.server.ts` — unchanged
