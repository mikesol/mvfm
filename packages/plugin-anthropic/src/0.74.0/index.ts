// ============================================================
// MVFM PLUGIN: anthropic (@anthropic-ai/sdk compatible API)
// ============================================================
//
// Implementation status: FULL (all 9 operations)
// Plugin size: SMALL — fully implemented (9 operations)
//
// Implemented:
//   - Messages: create, countTokens
//   - Message Batches: create, retrieve, list, delete, cancel
//   - Models: retrieve, list
//
// Not doable (fundamental mismatch with AST model):
//   (none — every Anthropic resource is request/response, all are
//   modelable.)
//
// Remaining (same pattern, add as needed):
//   - Completions (legacy)
//   - Beta features (prompt caching, etc.)
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to AnthropicMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — anthropic/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows @anthropic-ai/sdk should be able to
// write Mvfm programs with near-zero learning curve. The API
// should look like the real Anthropic SDK as closely as possible.
//
// Real @anthropic-ai/sdk API (v0.74.0):
//   const anthropic = new Anthropic({ apiKey: '...' })
//   const msg = await anthropic.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//   const tokens = await anthropic.messages.countTokens({ model: '...', messages: [...] })
//   const batch = await anthropic.messages.batches.create({ requests: [...] })
//   const batch = await anthropic.messages.batches.retrieve('msgbatch_123')
//   const batches = await anthropic.messages.batches.list({ limit: 10 })
//   await anthropic.messages.batches.delete('msgbatch_123')
//   const batch = await anthropic.messages.batches.cancel('msgbatch_123')
//   const model = await anthropic.models.retrieve('claude-sonnet-4-20250514')
//   const models = await anthropic.models.list({ limit: 5 })
//
// Based on source-level analysis of @anthropic-ai/sdk
// (github.com/anthropics/anthropic-sdk-typescript).
//
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
import type { Expr, PluginContext, PluginDefinition } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Anthropic operations added to the DSL context by the anthropic plugin.
 *
 * Mirrors the \@anthropic-ai/sdk resource API: messages (create,
 * countTokens), message batches (create, retrieve, list, delete,
 * cancel), and models (retrieve, list). Each resource exposes
 * methods that produce namespaced AST nodes.
 */
export interface AnthropicMethods {
  /** Anthropic API operations, namespaced under `$.anthropic`. */
  anthropic: {
    messages: {
      /** Create a message (chat completion). */
      create(
        params: Expr<MessageCreateParamsNonStreaming> | MessageCreateParamsNonStreaming,
      ): Expr<Message>;
      /** Count tokens for a message request. */
      countTokens(
        params: Expr<MessageCountTokensParams> | MessageCountTokensParams,
      ): Expr<MessageTokensCount>;
      batches: {
        /** Create a message batch. */
        create(params: Expr<BatchCreateParams> | BatchCreateParams): Expr<MessageBatch>;
        /** Retrieve a message batch by ID. */
        retrieve(id: Expr<string> | string): Expr<MessageBatch>;
        /** List message batches with optional filter params. */
        list(params?: Expr<BatchListParams> | BatchListParams): Expr<MessageBatchesPage>;
        /** Delete a message batch by ID. */
        delete(id: Expr<string> | string): Expr<DeletedMessageBatch>;
        /** Cancel a message batch by ID. */
        cancel(id: Expr<string> | string): Expr<MessageBatch>;
      };
    };
    models: {
      /** Retrieve a model by ID. */
      retrieve(id: Expr<string> | string): Expr<ModelInfo>;
      /** List models with optional filter params. */
      list(params?: Expr<ModelListParams> | ModelListParams): Expr<ModelInfosPage>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the anthropic plugin.
 *
 * Requires an API key. Optionally accepts a baseURL to override
 * the default Anthropic API endpoint.
 */
export interface AnthropicConfig {
  /** Anthropic API key (e.g. `sk-ant-api03-...`). */
  apiKey: string;
  /** Base URL override for the Anthropic API. */
  baseURL?: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Anthropic plugin factory. Namespace: `anthropic/`.
 *
 * Creates a plugin that exposes messages, message batches, and models
 * resource methods for building parameterized Anthropic API call AST nodes.
 *
 * @param config - An {@link AnthropicConfig} with apiKey and optional baseURL.
 * @returns A PluginDefinition for the anthropic plugin.
 */
export function anthropic(config: AnthropicConfig): PluginDefinition<AnthropicMethods> {
  return {
    name: "anthropic",
    nodeKinds: [
      "anthropic/create_message",
      "anthropic/count_tokens",
      "anthropic/create_message_batch",
      "anthropic/retrieve_message_batch",
      "anthropic/list_message_batches",
      "anthropic/delete_message_batch",
      "anthropic/cancel_message_batch",
      "anthropic/retrieve_model",
      "anthropic/list_models",
    ],

    build(ctx: PluginContext): AnthropicMethods {
      // Helper: resolve an id argument to an AST node.
      // If it's already an Expr, use its __node; otherwise lift the raw value.
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      // Helper: resolve a params object to an AST node.
      // ctx.lift handles both Expr and raw objects (lifts to core/record).
      function resolveParams<T>(params: Expr<T> | T) {
        return ctx.lift(params).__node;
      }

      return {
        anthropic: {
          messages: {
            create(params) {
              return ctx.expr({
                kind: "anthropic/create_message",
                params: resolveParams(params),
                config,
              });
            },

            countTokens(params) {
              return ctx.expr({
                kind: "anthropic/count_tokens",
                params: resolveParams(params),
                config,
              });
            },

            batches: {
              create(params) {
                return ctx.expr({
                  kind: "anthropic/create_message_batch",
                  params: resolveParams(params),
                  config,
                });
              },

              retrieve(id) {
                return ctx.expr({
                  kind: "anthropic/retrieve_message_batch",
                  id: resolveId(id),
                  config,
                });
              },

              list(params?) {
                return ctx.expr({
                  kind: "anthropic/list_message_batches",
                  params: params != null ? resolveParams(params) : null,
                  config,
                });
              },

              delete(id) {
                return ctx.expr({
                  kind: "anthropic/delete_message_batch",
                  id: resolveId(id),
                  config,
                });
              },

              cancel(id) {
                return ctx.expr({
                  kind: "anthropic/cancel_message_batch",
                  id: resolveId(id),
                  config,
                });
              },
            },
          },

          models: {
            retrieve(id) {
              return ctx.expr({
                kind: "anthropic/retrieve_model",
                id: resolveId(id),
                config,
              });
            },

            list(params?) {
              return ctx.expr({
                kind: "anthropic/list_models",
                params: params != null ? resolveParams(params) : null,
                config,
              });
            },
          },
        },
      };
    },
  };
}

// ============================================================
// HONEST ASSESSMENT: What works, what's hard, what breaks
// ============================================================
//
// WORKS GREAT:
//
// 1. Basic message creation:
//    Real:  const msg = await anthropic.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//    Mvfm:   const msg = $.anthropic.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Parameterized operations with proxy values:
//    const msg = $.anthropic.messages.create({ model: $.input.model, max_tokens: $.input.maxTokens, messages: $.input.messages })
//    Proxy chains capture the dependency graph perfectly.
//
// 3. Resource method naming:
//    Real:  anthropic.messages.create(...)
//    Mvfm:   $.anthropic.messages.create(...)
//    The nested resource pattern maps 1:1. An LLM that knows
//    @anthropic-ai/sdk can write Mvfm Anthropic programs immediately.
//
// 4. Batch operations:
//    Real:  await anthropic.messages.batches.create({ requests: [...] })
//    Mvfm:   $.anthropic.messages.batches.create({ requests: [...] })
//    The 3-level nesting (messages.batches.create) works naturally.
//
// WORKS BUT DIFFERENT:
//
// 5. Return/input types:
//    Public method signatures use SDK-aligned request/response types
//    (MessageCreateParamsNonStreaming, MessageBatch, ModelInfo, etc.).
//    This preserves IDE assistance and catches invalid request shapes.
//
//    Note: list methods are typed as SDK page shapes
//    (MessageBatchesPage/ModelInfosPage), while execution still follows
//    MVFM's generic interpreter flow (`anthropic/api_call` effects).
//
// 6. Sequencing side effects:
//    Real:  const msg = await anthropic.messages.create(...)
//    Mvfm:   const msg = $.anthropic.messages.create(...)
//           return $.discard(msg)
//    Must use $.discard() for sequencing when there are data dependencies.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Streaming:
//    Real:  const stream = await anthropic.messages.create({ ..., stream: true })
//           for await (const event of stream) { ... }
//    Mvfm:   Can't model async iterators/streams. Create returns
//           the complete response. Streaming belongs in the
//           interpreter/runtime layer.
//
// 8. Tool use / function calling:
//    Real:  anthropic.messages.create({ ..., tools: [...] })
//    Mvfm:   The params object can include tools, but tool execution
//           loops (check stop_reason, call tool, send result back)
//           would need $.rec() for the iterative loop pattern.
//
// 9. Beta features (prompt caching, computer use):
//    Real:  anthropic.beta.promptCaching.messages.create(...)
//    Mvfm:   Not modeled. Beta APIs change frequently and belong
//           in a separate beta plugin or version bump.
//
// ============================================================
// SUMMARY:
// Based on source-level analysis of @anthropic-ai/sdk
// (github.com/anthropics/anthropic-sdk-typescript, v0.74.0).
//
// For the core use case of "send messages to Claude and manage
// batches/models" — this is nearly identical to the real SDK.
// Resource nesting (messages, messages.batches, models) maps 1:1.
// Proxy chains capture cross-operation dependencies perfectly.
//
// Public input/return types are aligned to SDK request/response
// definitions where possible. Remaining differences are in execution
// model (deterministic AST/interpreter flow), not method signatures.
//
// Not supported: streaming, tool use loops, beta features,
// file uploads. These are either runtime concerns (streaming)
// or could be added incrementally (tool use via $.rec loops,
// beta as separate plugin version).
// ============================================================
