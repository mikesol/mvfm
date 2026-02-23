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

import type { CExpr, Interpreter, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";
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

// ---- Constructor builder ----------------------------------

/**
 * Builds the openai constructor methods using makeCExpr.
 *
 * Constructors use Liftable<T> for object params and string | CExpr<string>
 * for ID params. Validation happens at `app()` time via KindSpec.
 */
function buildOpenAIApi() {
  return {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create(
          params: Liftable<ChatCompletionCreateParamsNonStreaming>,
        ): CExpr<
          ChatCompletion,
          "openai/create_chat_completion",
          [Liftable<ChatCompletionCreateParamsNonStreaming>]
        > {
          return makeCExpr("openai/create_chat_completion", [params]) as any;
        },
        /** Retrieve a chat completion by ID. */
        retrieve(
          id: string | CExpr<string>,
        ): CExpr<ChatCompletion, "openai/retrieve_chat_completion", [string | CExpr<string>]> {
          return makeCExpr("openai/retrieve_chat_completion", [id]) as any;
        },
        /** List chat completions with optional filter params. */
        list(
          ...params: [] | [Liftable<ChatCompletionListParams>]
        ): CExpr<
          ChatCompletionsPage,
          "openai/list_chat_completions",
          [] | [Liftable<ChatCompletionListParams>]
        > {
          return makeCExpr("openai/list_chat_completions", params as unknown[]) as any;
        },
        /** Update a chat completion by ID. */
        update(
          id: string | CExpr<string>,
          params: Liftable<ChatCompletionUpdateParams>,
        ): CExpr<
          ChatCompletion,
          "openai/update_chat_completion",
          [string | CExpr<string>, Liftable<ChatCompletionUpdateParams>]
        > {
          return makeCExpr("openai/update_chat_completion", [id, params]) as any;
        },
        /** Delete a chat completion by ID. */
        delete(
          id: string | CExpr<string>,
        ): CExpr<ChatCompletionDeleted, "openai/delete_chat_completion", [string | CExpr<string>]> {
          return makeCExpr("openai/delete_chat_completion", [id]) as any;
        },
      },
    },
    embeddings: {
      /** Create embeddings for the given input. */
      create(
        params: Liftable<EmbeddingCreateParams>,
      ): CExpr<
        CreateEmbeddingResponse,
        "openai/create_embedding",
        [Liftable<EmbeddingCreateParams>]
      > {
        return makeCExpr("openai/create_embedding", [params]) as any;
      },
    },
    moderations: {
      /** Classify text for policy compliance. */
      create(
        params: Liftable<ModerationCreateParams>,
      ): CExpr<
        ModerationCreateResponse,
        "openai/create_moderation",
        [Liftable<ModerationCreateParams>]
      > {
        return makeCExpr("openai/create_moderation", [params]) as any;
      },
    },
    completions: {
      /** Create a legacy completion (non-streaming). */
      create(
        params: Liftable<CompletionCreateParamsNonStreaming>,
      ): CExpr<
        Completion,
        "openai/create_completion",
        [Liftable<CompletionCreateParamsNonStreaming>]
      > {
        return makeCExpr("openai/create_completion", [params]) as any;
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
    kinds: {
      "openai/create_chat_completion": {
        inputs: [undefined as unknown as ChatCompletionCreateParamsNonStreaming],
        output: undefined as unknown as ChatCompletion,
      } as KindSpec<[ChatCompletionCreateParamsNonStreaming], ChatCompletion>,
      "openai/retrieve_chat_completion": {
        inputs: [""] as [string],
        output: undefined as unknown as ChatCompletion,
      } as KindSpec<[string], ChatCompletion>,
      "openai/list_chat_completions": {
        inputs: [] as ChatCompletionListParams[],
        output: undefined as unknown as ChatCompletionsPage,
      } as KindSpec<ChatCompletionListParams[], ChatCompletionsPage>,
      "openai/update_chat_completion": {
        inputs: ["", undefined as unknown as ChatCompletionUpdateParams],
        output: undefined as unknown as ChatCompletion,
      } as KindSpec<[string, ChatCompletionUpdateParams], ChatCompletion>,
      "openai/delete_chat_completion": {
        inputs: [""] as [string],
        output: undefined as unknown as ChatCompletionDeleted,
      } as KindSpec<[string], ChatCompletionDeleted>,
      "openai/create_embedding": {
        inputs: [undefined as unknown as EmbeddingCreateParams],
        output: undefined as unknown as CreateEmbeddingResponse,
      } as KindSpec<[EmbeddingCreateParams], CreateEmbeddingResponse>,
      "openai/create_moderation": {
        inputs: [undefined as unknown as ModerationCreateParams],
        output: undefined as unknown as ModerationCreateResponse,
      } as KindSpec<[ModerationCreateParams], ModerationCreateResponse>,
      "openai/create_completion": {
        inputs: [undefined as unknown as CompletionCreateParamsNonStreaming],
        output: undefined as unknown as Completion,
      } as KindSpec<[CompletionCreateParamsNonStreaming], Completion>,
    },
    shapes: {
      "openai/create_chat_completion": "*",
      "openai/list_chat_completions": "*",
      "openai/update_chat_completion": [null, "*"],
      "openai/create_embedding": "*",
      "openai/create_moderation": "*",
      "openai/create_completion": "*",
    },
    traits: {},
    lifts: {},
    defaultInterpreter: (): Interpreter => createDefaultInterpreter(config),
  } satisfies Plugin;
}

/**
 * Alias for {@link openai}, kept for readability at call sites.
 */
export const openaiPlugin = openai;
