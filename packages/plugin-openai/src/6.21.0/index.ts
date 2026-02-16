// ============================================================
// MVFM PLUGIN: openai (openai-node compatible API)
// ============================================================
//
// Implementation status: PARTIAL (4 of 22 top-level resources)
// Plugin size: SMALL — fully implemented for "AI text" scope
//
// Implemented:
//   - Chat Completions: create, retrieve, list, update, delete
//   - Embeddings: create
//   - Moderations: create
//   - Completions (legacy): create
//
// Not doable (fundamental mismatch with AST model):
//   - Streaming (stream: true) — returns async iterable Stream<ChatCompletionChunk>,
//     not a finite request-response. Omitted from params entirely.
//   - Auto-pagination — list() returns first page. Full pagination
//     via $.rec() with has_more/after logic.
//   - Realtime API — WebSocket-based, bidirectional push.
//   - File uploads — files.create() takes Uploadable (binary stream).
//
// Remaining (same request-response pattern, add as needed):
//   images, audio, files, models, fine-tuning, vector-stores,
//   batches, uploads, responses, beta, graders, evals,
//   containers, skills, videos, conversations, webhooks.
//
//   Each resource follows the same pattern: add node kinds,
//   add methods to OpenAIMethods, add switch cases to the
//   interpreter. The interpreter/handler architecture does
//   not need to change — openai/api_call covers everything.
//
// ============================================================
//
// Goal: An LLM that knows openai-node should be able to write
// Mvfm programs with near-zero learning curve. The API hugs the
// real openai-node SDK 1:1.
//
// Real openai-node API (v6.21.0):
//   const openai = new OpenAI({ apiKey: 'sk-...' })
//   const completion = await openai.chat.completions.create({ model: 'gpt-4o', messages: [...] })
//   const completion = await openai.chat.completions.retrieve('cmpl_123')
//   const completions = await openai.chat.completions.list({ model: 'gpt-4o' })
//   const updated = await openai.chat.completions.update('cmpl_123', { metadata: {...} })
//   const deleted = await openai.chat.completions.delete('cmpl_123')
//   const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: 'hello' })
//   const moderation = await openai.moderations.create({ input: 'some text' })
//   const completion = await openai.completions.create({ model: 'gpt-3.5-turbo-instruct', prompt: 'Say hello' })
//
// Based on source-level analysis of openai-node v6.21.0
// (github.com/openai/openai-node). The SDK extends APIResource
// with methods calling this._client.post/get/delete with path
// and body/options.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "@mvfm/core";

// ---- What the plugin adds to $ ----------------------------

/**
 * OpenAI operations added to the DSL context by the openai plugin.
 *
 * Mirrors the openai-node SDK resource API: chat completions,
 * embeddings, moderations, and legacy completions. Each resource
 * exposes methods that produce namespaced AST nodes.
 */
export interface OpenAIMethods {
  /** OpenAI API operations, namespaced under `$.openai`. */
  openai: {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create(
          params: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): Expr<Record<string, unknown>>;
        /** Retrieve a chat completion by ID. */
        retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
        /** List chat completions with optional filter params. */
        list(
          params?: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): Expr<Record<string, unknown>>;
        /** Update a chat completion by ID. */
        update(
          id: Expr<string> | string,
          params: Expr<Record<string, unknown>> | Record<string, unknown>,
        ): Expr<Record<string, unknown>>;
        /** Delete a chat completion by ID. */
        delete(id: Expr<string> | string): Expr<Record<string, unknown>>;
      };
    };
    embeddings: {
      /** Create embeddings for the given input. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    moderations: {
      /** Classify text for policy compliance. */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
    completions: {
      /** Create a legacy completion (non-streaming). */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the openai plugin.
 *
 * Requires an API key. Optionally accepts organization and project
 * identifiers for scoped access.
 */
export interface OpenAIConfig {
  /** OpenAI API key (e.g. `sk-...`). */
  apiKey: string;
  /** Organization ID for scoped access. */
  organization?: string;
  /** Project ID for scoped access. */
  project?: string;
}

// ---- Plugin implementation --------------------------------

/**
 * OpenAI plugin factory. Namespace: `openai/`.
 *
 * Creates a plugin that exposes chat completions, embeddings,
 * moderations, and legacy completions for building parameterized
 * OpenAI API call AST nodes.
 *
 * @param config - An {@link OpenAIConfig} with apiKey and optional org/project.
 * @returns A PluginDefinition for the openai plugin.
 */
export function openai(config: OpenAIConfig): PluginDefinition<OpenAIMethods> {
  return {
    name: "openai",
    nodeKinds: [
      "openai/create_chat_completion",
      "openai/retrieve_chat_completion",
      "openai/list_chat_completions",
      "openai/update_chat_completion",
      "openai/delete_chat_completion",
      "openai/create_embedding",
      "openai/create_moderation",
      "openai/create_completion",
    ],

    build(ctx: PluginContext): OpenAIMethods {
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

      function resolveParams(params: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(params).__node;
      }

      return {
        openai: {
          chat: {
            completions: {
              create(params) {
                return ctx.expr({
                  kind: "openai/create_chat_completion",
                  params: resolveParams(params),
                  config,
                });
              },

              retrieve(id) {
                return ctx.expr({
                  kind: "openai/retrieve_chat_completion",
                  id: resolveId(id),
                  config,
                });
              },

              list(params?) {
                return ctx.expr({
                  kind: "openai/list_chat_completions",
                  params: params != null ? resolveParams(params) : null,
                  config,
                });
              },

              update(id, params) {
                return ctx.expr({
                  kind: "openai/update_chat_completion",
                  id: resolveId(id),
                  params: resolveParams(params),
                  config,
                });
              },

              delete(id) {
                return ctx.expr({
                  kind: "openai/delete_chat_completion",
                  id: resolveId(id),
                  config,
                });
              },
            },
          },

          embeddings: {
            create(params) {
              return ctx.expr({
                kind: "openai/create_embedding",
                params: resolveParams(params),
                config,
              });
            },
          },

          moderations: {
            create(params) {
              return ctx.expr({
                kind: "openai/create_moderation",
                params: resolveParams(params),
                config,
              });
            },
          },

          completions: {
            create(params) {
              return ctx.expr({
                kind: "openai/create_completion",
                params: resolveParams(params),
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
// 1. Chat completions (non-streaming):
//    Real:  const c = await openai.chat.completions.create({ model: 'gpt-4o', messages: [...] })
//    Mvfm:   const c = $.openai.chat.completions.create({ model: 'gpt-4o', messages: [...] })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Embeddings:
//    Real:  const e = await openai.embeddings.create({ model: 'text-embedding-3-small', input: 'hello' })
//    Mvfm:   const e = $.openai.embeddings.create({ model: 'text-embedding-3-small', input: 'hello' })
//    1:1 mapping.
//
// 3. Resource method naming:
//    Real:  openai.chat.completions.create(...)
//    Mvfm:   $.openai.chat.completions.create(...)
//    The nested resource pattern maps 1:1. An LLM that knows
//    openai-node can write Mvfm OpenAI programs immediately.
//
// WORKS BUT DIFFERENT:
//
// 4. Return types:
//    Real openai-node has typed response objects (ChatCompletion,
//    Embedding, etc.). Mvfm uses Record<string, unknown>.
//    Property access still works via proxy (completion.choices),
//    but there's no IDE autocomplete for OpenAI-specific fields.
//
// 5. Sequencing side effects:
//    Real:  await openai.chat.completions.create(...)
//           await openai.embeddings.create(...)
//    Mvfm:   const c = $.openai.chat.completions.create(...)
//           const e = $.openai.embeddings.create(...)
//           return $.begin(c, e)
//    Must use $.begin() for sequencing.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Streaming (stream: true):
//    Real:  const stream = await openai.chat.completions.create({ stream: true, ... })
//           for await (const chunk of stream) { ... }
//    Mvfm:   Not modeled. Async iterators are not request-response.
//           The stream parameter is omitted entirely.
//
// 7. Auto-pagination:
//    Real:  for await (const c of openai.chat.completions.list()) { ... }
//    Mvfm:   Returns first page only. Use $.rec() with has_more/after.
//
// 8. RequestOptions (second argument):
//    Real:  openai.chat.completions.create({...}, { timeout: 5000 })
//    Mvfm:   Not modeled. These are runtime concerns.
//
// ============================================================
