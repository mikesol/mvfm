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
import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapAnthropicSdk } from "./client-anthropic-sdk";
import { type AnthropicClient, createAnthropicInterpreter } from "./interpreter";

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

// ---- What the plugin adds to $ ----------------------------

/**
 * Anthropic operations added to the DSL context by the anthropic plugin.
 *
 * Mirrors the \@anthropic-ai/sdk resource API: messages (create,
 * countTokens), message batches (create, retrieve, list, delete,
 * cancel), and models (retrieve, list). Each resource exposes
 * methods that produce CExpr nodes.
 */
export interface AnthropicMethods {
  /** Anthropic API operations, namespaced under `$.anthropic`. */
  anthropic: {
    messages: {
      /** Create a message (chat completion). */
      create(
        params: MessageCreateParamsNonStreaming | CExpr<MessageCreateParamsNonStreaming>,
      ): CExpr<Message>;
      /** Count tokens for a message request. */
      countTokens(
        params: MessageCountTokensParams | CExpr<MessageCountTokensParams>,
      ): CExpr<MessageTokensCount>;
      batches: {
        /** Create a message batch. */
        create(params: BatchCreateParams | CExpr<BatchCreateParams>): CExpr<MessageBatch>;
        /** Retrieve a message batch by ID. */
        retrieve(id: string | CExpr<string>): CExpr<MessageBatch>;
        /** List message batches with optional filter params. */
        list(params?: BatchListParams | CExpr<BatchListParams>): CExpr<MessageBatchesPage>;
        /** Delete a message batch by ID. */
        delete(id: string | CExpr<string>): CExpr<DeletedMessageBatch>;
        /** Cancel a message batch by ID. */
        cancel(id: string | CExpr<string>): CExpr<MessageBatch>;
      };
    };
    models: {
      /** Retrieve a model by ID. */
      retrieve(id: string | CExpr<string>): CExpr<ModelInfo>;
      /** List models with optional filter params. */
      list(params?: ModelListParams | CExpr<ModelListParams>): CExpr<ModelInfosPage>;
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

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
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
    "anthropic/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "anthropic/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}

// ---- Constructor builder ----------------------------------

function buildAnthropicApi(): AnthropicMethods["anthropic"] {
  return {
    messages: {
      create(params) {
        return makeCExpr("anthropic/create_message", [liftArg(params)]);
      },
      countTokens(params) {
        return makeCExpr("anthropic/count_tokens", [liftArg(params)]);
      },
      batches: {
        create(params) {
          return makeCExpr("anthropic/create_message_batch", [liftArg(params)]);
        },
        retrieve(id) {
          return makeCExpr("anthropic/retrieve_message_batch", [id]);
        },
        list(params?) {
          if (params == null) {
            return makeCExpr("anthropic/list_message_batches", []);
          }
          return makeCExpr("anthropic/list_message_batches", [liftArg(params)]);
        },
        delete(id) {
          return makeCExpr("anthropic/delete_message_batch", [id]);
        },
        cancel(id) {
          return makeCExpr("anthropic/cancel_message_batch", [id]);
        },
      },
    },
    models: {
      retrieve(id) {
        return makeCExpr("anthropic/retrieve_model", [id]);
      },
      list(params?) {
        if (params == null) {
          return makeCExpr("anthropic/list_models", []);
        }
        return makeCExpr("anthropic/list_models", [liftArg(params)]);
      },
    },
  };
}

// ---- Default interpreter wiring ---------------------------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function createDefaultInterpreter(config: AnthropicConfig): Interpreter {
  let clientPromise: Promise<AnthropicClient> | undefined;
  const getClient = async (): Promise<AnthropicClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("@anthropic-ai/sdk").then((moduleValue) => {
        const Anthropic = moduleValue.default as new (
          opts: AnthropicConfig,
        ) => Parameters<typeof wrapAnthropicSdk>[0];
        return wrapAnthropicSdk(new Anthropic(config));
      });
    }
    return clientPromise;
  };

  const lazyClient: AnthropicClient = {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, params);
    },
  };

  return createAnthropicInterpreter(lazyClient);
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the anthropic plugin definition (unified Plugin type).
 *
 * @param config - An {@link AnthropicConfig} with apiKey and optional baseURL.
 * @returns A unified Plugin that contributes `$.anthropic`.
 */
export function anthropic(config: AnthropicConfig) {
  return {
    name: "anthropic" as const,
    ctors: { anthropic: buildAnthropicApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  };
}

/**
 * Alias for {@link anthropic}, kept for readability at call sites.
 */
export const anthropicPlugin = anthropic;
