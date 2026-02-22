// ============================================================
// MVFM PLUGIN: openai (openai-node compatible API) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - Chat Completions: create, retrieve, list, update, delete
//   - Embeddings: create
//   - Moderations: create
//   - Completions (legacy): create
// ============================================================

import type { CExpr, Interpreter, KindSpec } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionDeleted,
  ChatCompletionListParams,
  ChatCompletionsPage,
  ChatCompletionUpdateParams,
} from "openai/resources/chat/completions/completions";
import type { Completion, CompletionCreateParamsNonStreaming } from "openai/resources/completions";
import type { CreateEmbeddingResponse, EmbeddingCreateParams } from "openai/resources/embeddings";
import type {
  ModerationCreateParams,
  ModerationCreateResponse,
} from "openai/resources/moderations";
import { wrapOpenAISdk } from "./client-openai-sdk";
import { createOpenAIInterpreter, type OpenAIClient } from "./interpreter";

// ---- liftArg: recursive plain-value → CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `openai/record` CExprs with key-value child pairs.
 * - Arrays become `openai/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("openai/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("openai/record", pairs);
  }
  return value;
}

// ---- What the plugin adds to $ ----------------------------

/**
 * OpenAI operations added to the DSL context by the openai plugin.
 *
 * Mirrors the openai-node SDK resource API: chat completions,
 * embeddings, moderations, and legacy completions. Each resource
 * exposes methods that produce CExpr nodes.
 */
export interface OpenAIMethods {
  /** OpenAI API operations, namespaced under `$.openai`. */
  openai: {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create(
          params:
            | ChatCompletionCreateParamsNonStreaming
            | CExpr<ChatCompletionCreateParamsNonStreaming>,
        ): CExpr<ChatCompletion>;
        /** Retrieve a chat completion by ID. */
        retrieve(id: string | CExpr<string>): CExpr<ChatCompletion>;
        /** List chat completions with optional filter params. */
        list(
          params?: ChatCompletionListParams | CExpr<ChatCompletionListParams>,
        ): CExpr<ChatCompletionsPage>;
        /** Update a chat completion by ID. */
        update(
          id: string | CExpr<string>,
          params: ChatCompletionUpdateParams | CExpr<ChatCompletionUpdateParams>,
        ): CExpr<ChatCompletion>;
        /** Delete a chat completion by ID. */
        delete(id: string | CExpr<string>): CExpr<ChatCompletionDeleted>;
      };
    };
    embeddings: {
      /** Create embeddings for the given input. */
      create(
        params: EmbeddingCreateParams | CExpr<EmbeddingCreateParams>,
      ): CExpr<CreateEmbeddingResponse>;
    };
    moderations: {
      /** Classify text for policy compliance. */
      create(
        params: ModerationCreateParams | CExpr<ModerationCreateParams>,
      ): CExpr<ModerationCreateResponse>;
    };
    completions: {
      /** Create a legacy completion (non-streaming). */
      create(
        params: CompletionCreateParamsNonStreaming | CExpr<CompletionCreateParamsNonStreaming>,
      ): CExpr<Completion>;
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

// ---- Node kinds -------------------------------------------

function buildKinds(): Record<string, KindSpec<any, any>> {
  return {
    "openai/create_chat_completion": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/retrieve_chat_completion": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/list_chat_completions": {
      inputs: [] as unknown[],
      output: undefined as unknown,
    } as KindSpec<unknown[], unknown>,
    "openai/update_chat_completion": {
      inputs: [undefined, undefined] as [unknown, unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown, unknown], unknown>,
    "openai/delete_chat_completion": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/create_embedding": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/create_moderation": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/create_completion": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "openai/record": {
      inputs: [] as unknown[],
      output: {} as Record<string, unknown>,
    } as KindSpec<unknown[], Record<string, unknown>>,
    "openai/array": {
      inputs: [] as unknown[],
      output: [] as unknown[],
    } as KindSpec<unknown[], unknown[]>,
  };
}

// ---- Constructor builder ----------------------------------

function buildOpenAIApi(): OpenAIMethods["openai"] {
  return {
    chat: {
      completions: {
        create(params) {
          return makeCExpr("openai/create_chat_completion", [liftArg(params)]);
        },
        retrieve(id) {
          return makeCExpr("openai/retrieve_chat_completion", [id]);
        },
        list(params?) {
          if (params == null) {
            return makeCExpr("openai/list_chat_completions", []);
          }
          return makeCExpr("openai/list_chat_completions", [liftArg(params)]);
        },
        update(id, params) {
          return makeCExpr("openai/update_chat_completion", [id, liftArg(params)]);
        },
        delete(id) {
          return makeCExpr("openai/delete_chat_completion", [id]);
        },
      },
    },
    embeddings: {
      create(params) {
        return makeCExpr("openai/create_embedding", [liftArg(params)]);
      },
    },
    moderations: {
      create(params) {
        return makeCExpr("openai/create_moderation", [liftArg(params)]);
      },
    },
    completions: {
      create(params) {
        return makeCExpr("openai/create_completion", [liftArg(params)]);
      },
    },
  };
}

// ---- Default interpreter wiring ---------------------------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function createDefaultInterpreter(config: OpenAIConfig): Interpreter {
  let clientPromise: Promise<OpenAIClient> | undefined;
  const getClient = async (): Promise<OpenAIClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("openai").then((moduleValue) => {
        const OpenAI = moduleValue.default as new (
          opts: OpenAIConfig,
        ) => Parameters<typeof wrapOpenAISdk>[0];
        return wrapOpenAISdk(new OpenAI(config));
      });
    }
    return clientPromise;
  };

  const lazyClient: OpenAIClient = {
    async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
      const client = await getClient();
      return client.request(method, path, body);
    },
  };

  return createOpenAIInterpreter(lazyClient);
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the openai plugin definition (unified Plugin type).
 *
 * @param config - An {@link OpenAIConfig} with apiKey and optional org/project.
 * @returns A unified Plugin that contributes `$.openai`.
 */
export function openai(config: OpenAIConfig) {
  return {
    name: "openai" as const,
    ctors: { openai: buildOpenAIApi() },
    kinds: buildKinds(),
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  };
}

/**
 * Alias for {@link openai}, kept for readability at call sites.
 */
export const openaiPlugin = openai;
