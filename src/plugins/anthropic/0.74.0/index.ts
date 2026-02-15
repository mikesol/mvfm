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

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Anthropic operations added to the DSL context by the anthropic plugin.
 *
 * Mirrors the @anthropic-ai/sdk resource API: messages (create,
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
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Count tokens for a message request. */
      countTokens(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      batches: {
        /** Create a message batch. */
        create(
          params: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): Expr<Record<string, unknown>>;
        /** Retrieve a message batch by ID. */
        retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
        /** List message batches with optional filter params. */
        list(
          params?: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): Expr<Record<string, unknown>>;
        /** Delete a message batch by ID. */
        delete(id: Expr<string> | string): Expr<Record<string, unknown>>;
        /** Cancel a message batch by ID. */
        cancel(id: Expr<string> | string): Expr<Record<string, unknown>>;
      };
    };
    models: {
      /** Retrieve a model by ID. */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** List models with optional filter params. */
      list(
        params?: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
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
 * @returns A {@link PluginDefinition} for the anthropic plugin.
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
      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
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
// 5. Return types:
//    Real @anthropic-ai/sdk has typed response objects (Message,
//    MessageBatch, ModelInfo, etc.) with precise type definitions.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (msg.content, batch.id),
//    but there's no IDE autocomplete for Anthropic-specific fields.
//    A future enhancement could add typed response interfaces.
//
// 6. Sequencing side effects:
//    Real:  const msg = await anthropic.messages.create(...)
//    Mvfm:   const msg = $.anthropic.messages.create(...)
//           return $.do(msg)
//    Must use $.do() for sequencing when there are data dependencies.
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
// The main gap is typed response objects — we use
// Record<string, unknown> instead of Anthropic.Message etc.
// This means no autocomplete on response fields, but property
// access still works at runtime via proxy.
//
// Not supported: streaming, tool use loops, beta features,
// file uploads. These are either runtime concerns (streaming)
// or could be added incrementally (tool use via $.rec loops,
// beta as separate plugin version).
// ============================================================
