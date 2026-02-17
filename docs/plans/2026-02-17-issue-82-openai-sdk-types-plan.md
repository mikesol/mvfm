# Issue 82: Align OpenAI Plugin Types to SDK — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `Record<string, unknown>` in OpenAI plugin's public API with openai-node SDK types for full type precision.

**Architecture:** Import specific request/response types from `openai/resources/...` and use them in the `OpenAIMethods` interface. Internal interpreter types stay generic. This is a compile-time-only change.

**Tech Stack:** TypeScript, openai-node SDK v6.22.0

---

### Task 1: Add SDK type imports and update OpenAIMethods

**Files:**
- Modify: `packages/plugin-openai/src/6.21.0/index.ts:56-112`

**Step 1: Add SDK type imports**

Add after line 57 (`import { definePlugin } from "@mvfm/core";`):

```typescript
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionDeleted,
  ChatCompletionListParams,
  ChatCompletionUpdateParams,
  ChatCompletionsPage,
} from "openai/resources/chat/completions/completions";
import type { Completion, CompletionCreateParamsNonStreaming } from "openai/resources/completions";
import type { CreateEmbeddingResponse, EmbeddingCreateParams } from "openai/resources/embeddings";
import type { ModerationCreateParams, ModerationCreateResponse } from "openai/resources/moderations";
```

**Step 2: Replace types in OpenAIMethods**

Replace the `OpenAIMethods` interface body with:

```typescript
export interface OpenAIMethods {
  /** OpenAI API operations, namespaced under `$.openai`. */
  openai: {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create(
          params: Expr<ChatCompletionCreateParamsNonStreaming> | ChatCompletionCreateParamsNonStreaming,
        ): Expr<ChatCompletion>;
        /** Retrieve a chat completion by ID. */
        retrieve(id: Expr<string> | string): Expr<ChatCompletion>;
        /** List chat completions with optional filter params. */
        list(
          params?: Expr<ChatCompletionListParams> | ChatCompletionListParams,
        ): Expr<ChatCompletionsPage>;
        /** Update a chat completion by ID. */
        update(
          id: Expr<string> | string,
          params: Expr<ChatCompletionUpdateParams> | ChatCompletionUpdateParams,
        ): Expr<ChatCompletion>;
        /** Delete a chat completion by ID. */
        delete(id: Expr<string> | string): Expr<ChatCompletionDeleted>;
      };
    };
    embeddings: {
      /** Create embeddings for the given input. */
      create(
        params: Expr<EmbeddingCreateParams> | EmbeddingCreateParams,
      ): Expr<CreateEmbeddingResponse>;
    };
    moderations: {
      /** Classify text for policy compliance. */
      create(
        params: Expr<ModerationCreateParams> | ModerationCreateParams,
      ): Expr<ModerationCreateResponse>;
    };
    completions: {
      /** Create a legacy completion (non-streaming). */
      create(
        params: Expr<CompletionCreateParamsNonStreaming> | CompletionCreateParamsNonStreaming,
      ): Expr<Completion>;
    };
  };
}
```

**Step 3: Update the `resolveParams` helper signature**

The existing `resolveParams` helper has type `Expr<Record<string, unknown>> | Record<string, unknown>`. Since it's called with various specific types that are all objects, widen the signature to accept any object type:

```typescript
function resolveParams(params: Expr<any> | Record<string, any>) {
  return ctx.lift(params).__node;
}
```

This is internal to `build()` and doesn't affect the public API.

**Step 4: Update the honest assessment comment**

Replace lines 273-277 (the "Return types" comment) with:

```typescript
// 4. Return types:
//    Mvfm now uses openai-node SDK types (ChatCompletion,
//    CreateEmbeddingResponse, etc.) for both params and returns.
//    IDE autocomplete works for OpenAI-specific fields via Expr<T>.
```

**Step 5: Build to verify types compile**

Run: `cd packages/plugin-openai && npx tsc --noEmit`
Expected: No errors

**Step 6: Run tests**

Run: `cd packages/plugin-openai && npm test`
Expected: All tests pass (change is compile-time only)

**Step 7: Run full validation**

Run: `npm run build && npm run check && npm test`
Expected: All pass

**Step 8: Commit**

```bash
git add packages/plugin-openai/src/6.21.0/index.ts
git commit -m "feat(plugin-openai): align inputs/outputs to openai-node SDK types

Closes #82"
```
