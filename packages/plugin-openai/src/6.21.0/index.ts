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

import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import type {
  ChatCompletion,
  ChatCompletionDeleted,
  ChatCompletionsPage,
} from "openai/resources/chat/completions/completions";
import type { Completion } from "openai/resources/completions";
import type { CreateEmbeddingResponse } from "openai/resources/embeddings";
import type { ModerationCreateResponse } from "openai/resources/moderations";
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

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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
 * Builds the openai constructor methods using makeCExpr + liftArg.
 *
 * Constructors use permissive generics so any argument type is accepted
 * at construction time. Validation happens at `app()` time via KindSpec.
 */
function buildOpenAIApi() {
  return {
    chat: {
      completions: {
        /** Create a chat completion (non-streaming). */
        create<A>(params: A): CExpr<ChatCompletion, "openai/create_chat_completion", [A]> {
          return mk("openai/create_chat_completion", [liftArg(params)]);
        },
        /** Retrieve a chat completion by ID. */
        retrieve<A>(id: A): CExpr<ChatCompletion, "openai/retrieve_chat_completion", [A]> {
          return mk("openai/retrieve_chat_completion", [id]);
        },
        /** List chat completions with optional filter params. */
        list<A extends readonly unknown[]>(
          ...params: A
        ): CExpr<ChatCompletionsPage, "openai/list_chat_completions", A> {
          return mk(
            "openai/list_chat_completions",
            params.map((p) => liftArg(p)),
          );
        },
        /** Update a chat completion by ID. */
        update<A, B>(
          id: A,
          params: B,
        ): CExpr<ChatCompletion, "openai/update_chat_completion", [A, B]> {
          return mk("openai/update_chat_completion", [id, liftArg(params)]);
        },
        /** Delete a chat completion by ID. */
        delete<A>(id: A): CExpr<ChatCompletionDeleted, "openai/delete_chat_completion", [A]> {
          return mk("openai/delete_chat_completion", [id]);
        },
      },
    },
    embeddings: {
      /** Create embeddings for the given input. */
      create<A>(params: A): CExpr<CreateEmbeddingResponse, "openai/create_embedding", [A]> {
        return mk("openai/create_embedding", [liftArg(params)]);
      },
    },
    moderations: {
      /** Classify text for policy compliance. */
      create<A>(params: A): CExpr<ModerationCreateResponse, "openai/create_moderation", [A]> {
        return mk("openai/create_moderation", [liftArg(params)]);
      },
    },
    completions: {
      /** Create a legacy completion (non-streaming). */
      create<A>(params: A): CExpr<Completion, "openai/create_completion", [A]> {
        return mk("openai/create_completion", [liftArg(params)]);
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
      // Structural helpers (produced by liftArg)
      "openai/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "openai/array": {
        inputs: [] as unknown[],
        output: [] as unknown[],
      } as KindSpec<unknown[], unknown[]>,
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
