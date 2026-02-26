// ============================================================
// MVFM PLUGIN: anthropic (@anthropic-ai/sdk compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - Messages: create, countTokens
//   - Message Batches: create, retrieve, list, delete, cancel
//   - Models: retrieve, list
// ============================================================

import type {
  BatchCreateParams,
  BatchListParams,
  DeletedMessageBatch,
  MessageBatch,
  MessageBatchesPage,
} from "@anthropic-ai/sdk/resources/messages/batches";
import type {
  Message,
  MessageCountTokensParams,
  MessageCreateParamsNonStreaming,
  MessageTokensCount,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type {
  ModelInfo,
  ModelInfosPage,
  ModelListParams,
} from "@anthropic-ai/sdk/resources/models";
import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

// ---- Constructor builder ----------------------------------

/**
 * Builds the anthropic constructor methods using makeCExpr.
 *
 * Constructors use Liftable<T> for object params and string | CExpr<string>
 * for ID params. Validation happens at `app()` time via KindSpec.
 */
function buildAnthropicApi() {
  return {
    messages: {
      /** Create a message (chat completion). */
      create(
        params: Liftable<MessageCreateParamsNonStreaming>,
      ): CExpr<Message, "anthropic/create_message", [Liftable<MessageCreateParamsNonStreaming>]> {
        return makeCExpr("anthropic/create_message", [params]) as any;
      },
      /** Count tokens for a message request. */
      countTokens(
        params: Liftable<MessageCountTokensParams>,
      ): CExpr<MessageTokensCount, "anthropic/count_tokens", [Liftable<MessageCountTokensParams>]> {
        return makeCExpr("anthropic/count_tokens", [params]) as any;
      },
      batches: {
        /** Create a message batch. */
        create(
          params: Liftable<BatchCreateParams>,
        ): CExpr<MessageBatch, "anthropic/create_message_batch", [Liftable<BatchCreateParams>]> {
          return makeCExpr("anthropic/create_message_batch", [params]) as any;
        },
        /** Retrieve a message batch by ID. */
        retrieve(
          id: string | CExpr<string>,
        ): CExpr<MessageBatch, "anthropic/retrieve_message_batch", [string | CExpr<string>]> {
          return makeCExpr("anthropic/retrieve_message_batch", [id]) as any;
        },
        /** List message batches with optional filter params. */
        list(
          ...params: [] | [Liftable<BatchListParams>]
        ): CExpr<
          MessageBatchesPage,
          "anthropic/list_message_batches",
          [] | [Liftable<BatchListParams>]
        > {
          return makeCExpr("anthropic/list_message_batches", params as unknown[]) as any;
        },
        /** Delete a message batch by ID. */
        delete(
          id: string | CExpr<string>,
        ): CExpr<DeletedMessageBatch, "anthropic/delete_message_batch", [string | CExpr<string>]> {
          return makeCExpr("anthropic/delete_message_batch", [id]) as any;
        },
        /** Cancel a message batch by ID. */
        cancel(
          id: string | CExpr<string>,
        ): CExpr<MessageBatch, "anthropic/cancel_message_batch", [string | CExpr<string>]> {
          return makeCExpr("anthropic/cancel_message_batch", [id]) as any;
        },
      },
    },
    models: {
      /** Retrieve a model by ID. */
      retrieve(
        id: string | CExpr<string>,
      ): CExpr<ModelInfo, "anthropic/retrieve_model", [string | CExpr<string>]> {
        return makeCExpr("anthropic/retrieve_model", [id]) as any;
      },
      /** List models with optional filter params. */
      list(
        ...params: [] | [Liftable<ModelListParams>]
      ): CExpr<ModelInfosPage, "anthropic/list_models", [] | [Liftable<ModelListParams>]> {
        return makeCExpr("anthropic/list_models", params as unknown[]) as any;
      },
    },
  };
}

// ---- Plugin definition ------------------------------------

/**
 * The anthropic plugin definition (unified Plugin type).
 *
 * Contributes `$.anthropic` with messages and models API.
 * Requires an interpreter provided via
 * `defaults(plugins, { anthropic: createAnthropicInterpreter(client) })`.
 */
export const anthropic = {
  name: "anthropic" as const,
  ctors: { anthropic: buildAnthropicApi() },
  kinds: {
    "anthropic/create_message": {
      inputs: [undefined as unknown as MessageCreateParamsNonStreaming],
      output: undefined as unknown as Message,
    } as KindSpec<[MessageCreateParamsNonStreaming], Message>,
    "anthropic/count_tokens": {
      inputs: [undefined as unknown as MessageCountTokensParams],
      output: undefined as unknown as MessageTokensCount,
    } as KindSpec<[MessageCountTokensParams], MessageTokensCount>,
    "anthropic/create_message_batch": {
      inputs: [undefined as unknown as BatchCreateParams],
      output: undefined as unknown as MessageBatch,
    } as KindSpec<[BatchCreateParams], MessageBatch>,
    "anthropic/retrieve_message_batch": {
      inputs: [""] as [string],
      output: undefined as unknown as MessageBatch,
    } as KindSpec<[string], MessageBatch>,
    "anthropic/list_message_batches": {
      inputs: [] as BatchListParams[],
      output: undefined as unknown as MessageBatchesPage,
    } as KindSpec<BatchListParams[], MessageBatchesPage>,
    "anthropic/delete_message_batch": {
      inputs: [""] as [string],
      output: undefined as unknown as DeletedMessageBatch,
    } as KindSpec<[string], DeletedMessageBatch>,
    "anthropic/cancel_message_batch": {
      inputs: [""] as [string],
      output: undefined as unknown as MessageBatch,
    } as KindSpec<[string], MessageBatch>,
    "anthropic/retrieve_model": {
      inputs: [""] as [string],
      output: undefined as unknown as ModelInfo,
    } as KindSpec<[string], ModelInfo>,
    "anthropic/list_models": {
      inputs: [] as ModelListParams[],
      output: undefined as unknown as ModelInfosPage,
    } as KindSpec<ModelListParams[], ModelInfosPage>,
  },
  shapes: {
    "anthropic/create_message": "*",
    "anthropic/count_tokens": "*",
    "anthropic/create_message_batch": "*",
    "anthropic/list_message_batches": "*",
    "anthropic/list_models": "*",
  },
  traits: {},
  lifts: {},
} satisfies Plugin;

/**
 * Alias for {@link anthropic}, kept for readability at call sites.
 */
export const anthropicPlugin = anthropic;
