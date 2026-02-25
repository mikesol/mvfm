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
  DeletedMessageBatch,
  MessageBatch,
  MessageBatchesPage,
} from "@anthropic-ai/sdk/resources/messages/batches";
import type { Message, MessageTokensCount } from "@anthropic-ai/sdk/resources/messages/messages";
import type { ModelInfo, ModelInfosPage } from "@anthropic-ai/sdk/resources/models";
import type { CExpr, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";

// ---- liftArg: recursive plain-value -> CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `anthropic/record` CExprs with key-value child pairs.
 * - Arrays become `anthropic/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("anthropic/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("anthropic/record", pairs);
  }
  return value;
}

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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

// ---- Constructor builder ----------------------------------

/**
 * Builds the anthropic constructor methods using makeCExpr + liftArg.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildAnthropicApi() {
  return {
    messages: {
      /** Create a message (chat completion). */
      create<A>(params: A): CExpr<Message, "anthropic/create_message", [A]> {
        return mk("anthropic/create_message", [liftArg(params)]);
      },
      /** Count tokens for a message request. */
      countTokens<A>(params: A): CExpr<MessageTokensCount, "anthropic/count_tokens", [A]> {
        return mk("anthropic/count_tokens", [liftArg(params)]);
      },
      batches: {
        /** Create a message batch. */
        create<A>(params: A): CExpr<MessageBatch, "anthropic/create_message_batch", [A]> {
          return mk("anthropic/create_message_batch", [liftArg(params)]);
        },
        /** Retrieve a message batch by ID. */
        retrieve<A>(id: A): CExpr<MessageBatch, "anthropic/retrieve_message_batch", [A]> {
          return mk("anthropic/retrieve_message_batch", [id]);
        },
        /** List message batches with optional filter params. */
        list<A extends readonly unknown[]>(
          ...params: A
        ): CExpr<MessageBatchesPage, "anthropic/list_message_batches", A> {
          return mk(
            "anthropic/list_message_batches",
            params.map((p) => liftArg(p)),
          );
        },
        /** Delete a message batch by ID. */
        delete<A>(id: A): CExpr<DeletedMessageBatch, "anthropic/delete_message_batch", [A]> {
          return mk("anthropic/delete_message_batch", [id]);
        },
        /** Cancel a message batch by ID. */
        cancel<A>(id: A): CExpr<MessageBatch, "anthropic/cancel_message_batch", [A]> {
          return mk("anthropic/cancel_message_batch", [id]);
        },
      },
    },
    models: {
      /** Retrieve a model by ID. */
      retrieve<A>(id: A): CExpr<ModelInfo, "anthropic/retrieve_model", [A]> {
        return mk("anthropic/retrieve_model", [id]);
      },
      /** List models with optional filter params. */
      list<A extends readonly unknown[]>(
        ...params: A
      ): CExpr<ModelInfosPage, "anthropic/list_models", A> {
        return mk(
          "anthropic/list_models",
          params.map((p) => liftArg(p)),
        );
      },
    },
  };
}

// ---- Plugin definition ------------------------------------

/**
 * Anthropic plugin definition (unified Plugin type).
 *
 * This plugin has no defaultInterpreter — you must provide one
 * via `defaults(app, { anthropic: createAnthropicInterpreter(wrapAnthropicSdk(client)) })`.
 */
export const anthropic = {
  name: "anthropic" as const,
  ctors: { anthropic: buildAnthropicApi() },
  kinds: {
    "anthropic/create_message": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/count_tokens": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/create_message_batch": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/retrieve_message_batch": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/list_message_batches": {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>,
    "anthropic/delete_message_batch": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/cancel_message_batch": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/retrieve_model": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "anthropic/list_models": {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>,
    // Structural helpers (produced by liftArg)
    "anthropic/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "anthropic/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  },
  traits: {},
  lifts: {},
} satisfies Plugin;

/**
 * Alias for {@link anthropic}, kept for readability at call sites.
 */
export const anthropicPlugin = anthropic;
