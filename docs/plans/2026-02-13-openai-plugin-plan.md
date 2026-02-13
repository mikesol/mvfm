# OpenAI Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `openai` plugin wrapping openai-node v6.21.0 for AI text operations (chat completions, embeddings, moderations, legacy completions).

**Architecture:** External-service plugin following the Stripe pattern exactly. Uniform `openai/api_call` effect type. 8 node kinds. Config factory function. All files under `src/plugins/openai/6.21.0/`.

**Tech Stack:** TypeScript, vitest, openai-node SDK v6.21.0, Node.js `http` module for mock server in integration tests.

**Design doc:** `docs/plans/2026-02-13-openai-plugin-design.md`

---

### Task 1: Create directory structure and plugin definition (`index.ts`)

**Files:**
- Create: `src/plugins/openai/6.21.0/index.ts`
- Test: `tests/plugins/openai/6.21.0/index.test.ts`

**Step 1: Write the failing test**

Create `tests/plugins/openai/6.21.0/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { openai } from "../../../../src/plugins/openai/6.21.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, openai({ apiKey: "sk-test-123" }));

// ============================================================
// Chat Completions
// ============================================================

describe("openai: chat.completions.create", () => {
  it("produces openai/create_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_chat_completion");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("accepts Expr params and captures proxy dependencies", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.create({
        model: $.input.model,
        messages: $.input.messages,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_chat_completion");
    expect(ast.result.params.fields.model.kind).toBe("core/prop_access");
  });
});

describe("openai: chat.completions.retrieve", () => {
  it("produces openai/retrieve_chat_completion node with literal id", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.retrieve("cmpl_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/retrieve_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.retrieve($.input.completionId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("openai: chat.completions.list", () => {
  it("produces openai/list_chat_completions node with params", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.list({ model: "gpt-4o", limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/list_chat_completions");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/list_chat_completions");
    expect(ast.result.params).toBeNull();
  });
});

describe("openai: chat.completions.update", () => {
  it("produces openai/update_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.update("cmpl_123", { metadata: { key: "value" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/update_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("openai: chat.completions.delete", () => {
  it("produces openai/delete_chat_completion node", () => {
    const prog = app(($) => {
      return $.openai.chat.completions.delete("cmpl_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/delete_chat_completion");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("cmpl_123");
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai: embeddings.create", () => {
  it("produces openai/create_embedding node", () => {
    const prog = app(($) => {
      return $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_embedding");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai: moderations.create", () => {
  it("produces openai/create_moderation node", () => {
    const prog = app(($) => {
      return $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text to moderate",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_moderation");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai: completions.create", () => {
  it("produces openai/create_completion node", () => {
    const prog = app(($) => {
      return $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("openai/create_completion");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Integration with $.do() and cross-operation dependencies
// ============================================================

describe("openai: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const completion = $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        });
        const embedding = $.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: "Hello world",
        });
        return $.do(completion, embedding);
      });
    }).not.toThrow();
  });
});

describe("openai: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const completion = $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      const moderation = $.openai.moderations.create({
        input: (completion as any).choices,
      });
      return $.do(completion, moderation);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("core/do");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/plugins/openai/6.21.0/index.test.ts`
Expected: FAIL — module `../../../../src/plugins/openai/6.21.0` does not exist.

**Step 3: Write the plugin definition**

Create `src/plugins/openai/6.21.0/index.ts`:

```ts
// ============================================================
// ILO PLUGIN: openai (openai-node compatible API)
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
// Ilo programs with near-zero learning curve. The API hugs the
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

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

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
 * @returns A {@link PluginDefinition} for the openai plugin.
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
//    Ilo:   const c = $.openai.chat.completions.create({ model: 'gpt-4o', messages: [...] })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Embeddings:
//    Real:  const e = await openai.embeddings.create({ model: 'text-embedding-3-small', input: 'hello' })
//    Ilo:   const e = $.openai.embeddings.create({ model: 'text-embedding-3-small', input: 'hello' })
//    1:1 mapping.
//
// 3. Resource method naming:
//    Real:  openai.chat.completions.create(...)
//    Ilo:   $.openai.chat.completions.create(...)
//    The nested resource pattern maps 1:1. An LLM that knows
//    openai-node can write Ilo OpenAI programs immediately.
//
// WORKS BUT DIFFERENT:
//
// 4. Return types:
//    Real openai-node has typed response objects (ChatCompletion,
//    Embedding, etc.). Ilo uses Record<string, unknown>.
//    Property access still works via proxy (completion.choices),
//    but there's no IDE autocomplete for OpenAI-specific fields.
//
// 5. Sequencing side effects:
//    Real:  await openai.chat.completions.create(...)
//           await openai.embeddings.create(...)
//    Ilo:   const c = $.openai.chat.completions.create(...)
//           const e = $.openai.embeddings.create(...)
//           return $.do(c, e)
//    Must use $.do() for sequencing.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Streaming (stream: true):
//    Real:  const stream = await openai.chat.completions.create({ stream: true, ... })
//           for await (const chunk of stream) { ... }
//    Ilo:   Not modeled. Async iterators are not request-response.
//           The stream parameter is omitted entirely.
//
// 7. Auto-pagination:
//    Real:  for await (const c of openai.chat.completions.list()) { ... }
//    Ilo:   Returns first page only. Use $.rec() with has_more/after.
//
// 8. RequestOptions (second argument):
//    Real:  openai.chat.completions.create({...}, { timeout: 5000 })
//    Ilo:   Not modeled. These are runtime concerns.
//
// ============================================================
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/openai/6.21.0/index.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/openai/6.21.0/index.ts tests/plugins/openai/6.21.0/index.test.ts
git commit -m "feat(openai): add plugin definition and AST builder tests (#48)"
```

---

### Task 2: Interpreter fragment (`interpreter.ts`)

**Files:**
- Create: `src/plugins/openai/6.21.0/interpreter.ts`
- Test: `tests/plugins/openai/6.21.0/interpreter.test.ts`

**Step 1: Write the failing test**

Create `tests/plugins/openai/6.21.0/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { openai } from "../../../../src/plugins/openai/6.21.0";
import { openaiInterpreter } from "../../../../src/plugins/openai/6.21.0/interpreter";

const app = ilo(num, str, openai({ apiKey: "sk-test-123" }));
const fragments = [openaiInterpreter, coreInterpreter];

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const captured: any[] = [];
  const ast = injectInput(prog.ast, input);
  const recurse = foldAST(fragments, {
    "openai/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id", object: "mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Chat Completions
// ============================================================

describe("openai interpreter: create_chat_completion", () => {
  it("yields POST /chat/completions with correct body", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

describe("openai interpreter: retrieve_chat_completion", () => {
  it("yields GET /chat/completions/{id}", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("cmpl_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: list_chat_completions", () => {
  it("yields GET /chat/completions with query params", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.list({ model: "gpt-4o", limit: 10 }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toEqual({ model: "gpt-4o", limit: 10 });
  });

  it("yields GET /chat/completions with undefined body when omitted", async () => {
    const prog = app(($) => $.openai.chat.completions.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/chat/completions");
    expect(captured[0].body).toBeUndefined();
  });
});

describe("openai interpreter: update_chat_completion", () => {
  it("yields POST /chat/completions/{id} with body", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("cmpl_123", { metadata: { key: "value" } }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toEqual({ metadata: { key: "value" } });
  });
});

describe("openai interpreter: delete_chat_completion", () => {
  it("yields DELETE /chat/completions/{id}", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("cmpl_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/chat/completions/cmpl_123");
    expect(captured[0].body).toBeUndefined();
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai interpreter: create_embedding", () => {
  it("yields POST /embeddings with correct body", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/embeddings");
    expect(captured[0].body).toEqual({
      model: "text-embedding-3-small",
      input: "Hello world",
    });
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai interpreter: create_moderation", () => {
  it("yields POST /moderations with correct body", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/moderations");
    expect(captured[0].body).toEqual({
      model: "omni-moderation-latest",
      input: "some text",
    });
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai interpreter: create_completion", () => {
  it("yields POST /completions with correct body", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("openai/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/completions");
    expect(captured[0].body).toEqual({
      model: "gpt-3.5-turbo-instruct",
      prompt: "Say hello",
    });
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("openai interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ model: "string", content: "string" }, ($) =>
      $.openai.chat.completions.create({
        model: $.input.model,
        messages: [{ role: "user", content: $.input.content }],
      }),
    );
    const { captured } = await run(prog, { model: "gpt-4o", content: "Hi" });
    expect(captured).toHaveLength(1);
    expect(captured[0].body.model).toBe("gpt-4o");
  });

  it("resolves input id for retrieve", async () => {
    const prog = app({ completionId: "string" }, ($) =>
      $.openai.chat.completions.retrieve($.input.completionId),
    );
    const { captured } = await run(prog, { completionId: "cmpl_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].path).toBe("/chat/completions/cmpl_dynamic_456");
  });
});

// ============================================================
// Return value
// ============================================================

describe("openai interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("cmpl_123"));
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", object: "mock" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/plugins/openai/6.21.0/interpreter.test.ts`
Expected: FAIL — module `interpreter` does not exist.

**Step 3: Write the interpreter**

Create `src/plugins/openai/6.21.0/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * OpenAI client interface consumed by the openai handler.
 *
 * Abstracts over the actual OpenAI SDK so handlers can be
 * tested with mock clients.
 */
export interface OpenAIClient {
  /** Execute an OpenAI API request and return the parsed response. */
  request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for openai plugin nodes.
 *
 * Yields `openai/api_call` effects for all 8 operations. Each effect
 * contains the HTTP method, API path, and optional body matching the
 * OpenAI REST API conventions.
 */
export const openaiInterpreter: InterpreterFragment = {
  pluginName: "openai",
  canHandle: (node) => node.kind.startsWith("openai/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Chat Completions ----

      case "openai/create_chat_completion": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/chat/completions",
          body,
        };
      }

      case "openai/retrieve_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "GET",
          path: `/chat/completions/${id}`,
        };
      }

      case "openai/list_chat_completions": {
        const body =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "openai/api_call",
          method: "GET",
          path: "/chat/completions",
          ...(body !== undefined ? { body } : {}),
        };
      }

      case "openai/update_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: `/chat/completions/${id}`,
          body,
        };
      }

      case "openai/delete_chat_completion": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "DELETE",
          path: `/chat/completions/${id}`,
        };
      }

      // ---- Embeddings ----

      case "openai/create_embedding": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/embeddings",
          body,
        };
      }

      // ---- Moderations ----

      case "openai/create_moderation": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/moderations",
          body,
        };
      }

      // ---- Legacy Completions ----

      case "openai/create_completion": {
        const body = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "openai/api_call",
          method: "POST",
          path: "/completions",
          body,
        };
      }

      default:
        throw new Error(`OpenAI interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/plugins/openai/6.21.0/interpreter.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/openai/6.21.0/interpreter.ts tests/plugins/openai/6.21.0/interpreter.test.ts
git commit -m "feat(openai): add interpreter fragment with effect tests (#48)"
```

---

### Task 3: Server handler (`handler.server.ts`)

**Files:**
- Create: `src/plugins/openai/6.21.0/handler.server.ts`

**Step 1: Write the server handler**

Create `src/plugins/openai/6.21.0/handler.server.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { OpenAIClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes OpenAI effects
 * against a real OpenAI client.
 *
 * Handles `openai/api_call` effects by delegating to
 * `client.request(method, path, body)`. Throws on unhandled effect types.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: OpenAIClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "openai/api_call") {
      const { method, path, body } = effect as {
        type: "openai/api_call";
        method: string;
        path: string;
        body?: Record<string, unknown>;
      };
      const value = await client.request(method, path, body);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * an OpenAI client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: OpenAIClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Verify it type-checks**

Run: `npm run build`
Expected: PASS — no type errors.

**Step 3: Commit**

```bash
git add src/plugins/openai/6.21.0/handler.server.ts
git commit -m "feat(openai): add server handler (#48)"
```

---

### Task 4: Client handler (`handler.client.ts`)

**Files:**
- Create: `src/plugins/openai/6.21.0/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/openai/6.21.0/handler.client.ts`:

```ts
import type { StepContext, StepEffect, StepHandler } from "../../../core";

/**
 * Options for configuring the client-side handler.
 */
export interface ClientHandlerOptions {
  /** Base URL of the server endpoint (e.g., "https://api.example.com"). */
  baseUrl: string;
  /** Contract hash from the program, used for verification. */
  contractHash: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof globalThis.fetch;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
}

/**
 * State tracked by the client handler across steps.
 */
export interface ClientHandlerState {
  /** The current step index, incremented after each effect. */
  stepIndex: number;
}

/**
 * Creates a client-side {@link StepHandler} that sends effects as JSON
 * to a remote server endpoint for execution.
 *
 * Each effect is sent as a POST request to `{baseUrl}/ilo/execute` with
 * the contract hash, step index, path, and effect payload. The server
 * is expected to return `{ result: unknown }` in the response body.
 *
 * @param options - Configuration for the client handler.
 * @returns A {@link StepHandler} that tracks step indices.
 */
export function clientHandler(options: ClientHandlerOptions): StepHandler<ClientHandlerState> {
  const { baseUrl, contractHash, headers = {} } = options;
  const fetchFn = options.fetch ?? globalThis.fetch;

  return async (
    effect: StepEffect,
    context: StepContext,
    state: ClientHandlerState,
  ): Promise<{ value: unknown; state: ClientHandlerState }> => {
    const response = await fetchFn(`${baseUrl}/ilo/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        contractHash,
        stepIndex: state.stepIndex,
        path: context.path,
        effect,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Client handler: server returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { result: unknown };

    return {
      value: data.result,
      state: { stepIndex: state.stepIndex + 1 },
    };
  };
}
```

**Step 2: Verify it type-checks**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/openai/6.21.0/handler.client.ts
git commit -m "feat(openai): add client handler (#48)"
```

---

### Task 5: SDK adapter (`client-openai-sdk.ts`)

**Files:**
- Create: `src/plugins/openai/6.21.0/client-openai-sdk.ts`

**Step 1: Write the SDK adapter**

Create `src/plugins/openai/6.21.0/client-openai-sdk.ts`:

```ts
import type OpenAI from "openai";
import type { OpenAIClient } from "./interpreter";

/**
 * Wraps the official OpenAI SDK into an {@link OpenAIClient}.
 *
 * Uses the SDK's built-in HTTP methods (`post`, `get`, `delete`)
 * to send requests, preserving authentication, retries, and telemetry.
 *
 * @param client - A configured OpenAI SDK instance.
 * @returns An {@link OpenAIClient} adapter.
 */
export function wrapOpenAISdk(client: OpenAI): OpenAIClient {
  return {
    async request(
      method: string,
      path: string,
      body?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      switch (upperMethod) {
        case "POST":
          return client.post(path, { body: body ?? {} });
        case "GET":
          return client.get(path, { query: body });
        case "DELETE":
          return client.delete(path);
        default:
          throw new Error(`wrapOpenAISdk: unsupported method "${method}"`);
      }
    },
  };
}
```

**Step 2: Verify it type-checks**

Run: `npm run build`
Expected: PASS. NOTE: The `openai` package must be a devDependency. If it's not installed:

```bash
npm install --save-dev openai
```

**Step 3: Commit**

```bash
git add src/plugins/openai/6.21.0/client-openai-sdk.ts
git commit -m "feat(openai): add SDK adapter (#48)"
```

---

### Task 6: Public exports (`src/index.ts`)

**Files:**
- Modify: `src/index.ts`

**Step 1: Add openai exports**

Add the following exports to `src/index.ts`, after the stripe exports block (around line 93):

```ts
export type { OpenAIConfig, OpenAIMethods } from "./plugins/openai/6.21.0";
export { openai } from "./plugins/openai/6.21.0";
export { wrapOpenAISdk } from "./plugins/openai/6.21.0/client-openai-sdk";
export type {
  ClientHandlerOptions as OpenAIClientHandlerOptions,
  ClientHandlerState as OpenAIClientHandlerState,
} from "./plugins/openai/6.21.0/handler.client";
export { clientHandler as openaiClientHandler } from "./plugins/openai/6.21.0/handler.client";
export {
  serverEvaluate as openaiServerEvaluate,
  serverHandler as openaiServerHandler,
} from "./plugins/openai/6.21.0/handler.server";
export type { OpenAIClient } from "./plugins/openai/6.21.0/interpreter";
export { openaiInterpreter } from "./plugins/openai/6.21.0/interpreter";
```

**Step 2: Verify build and existing tests**

Run: `npm run build && npm run check && npm test`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(openai): add public exports (#48)"
```

---

### Task 7: Integration tests (`integration.test.ts`)

**Files:**
- Create: `tests/plugins/openai/6.21.0/integration.test.ts`

**Step 1: Write the integration test**

Create `tests/plugins/openai/6.21.0/integration.test.ts`:

```ts
import * as http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { error } from "../../../../src/plugins/error";
import { errorInterpreter } from "../../../../src/plugins/error/interpreter";
import { fiber } from "../../../../src/plugins/fiber";
import { fiberInterpreter } from "../../../../src/plugins/fiber/interpreter";
import { num } from "../../../../src/plugins/num";
import { numInterpreter } from "../../../../src/plugins/num/interpreter";
import { str } from "../../../../src/plugins/str";
import { strInterpreter } from "../../../../src/plugins/str/interpreter";
import { openai as openaiPlugin } from "../../../../src/plugins/openai/6.21.0";
import { serverEvaluate } from "../../../../src/plugins/openai/6.21.0/handler.server";
import { openaiInterpreter } from "../../../../src/plugins/openai/6.21.0/interpreter";
import type { OpenAIClient } from "../../../../src/plugins/openai/6.21.0/interpreter";

function injectInput(node: any, input: Record<string, unknown>): any {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => injectInput(n, input));
  const result: any = {};
  for (const [k, v] of Object.entries(node)) {
    result[k] = injectInput(v, input);
  }
  if (result.kind === "core/input") result.__inputData = input;
  return result;
}

// ---- Lightweight mock OpenAI HTTP server ----

let mockServer: http.Server;
let mockBaseUrl: string;

const MOCK_RESPONSES: Record<string, Record<string, any>> = {
  "POST /chat/completions": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello!" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  },
  "GET /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [],
  },
  "GET /chat/completions": {
    object: "list",
    data: [{ id: "chatcmpl-mock123", object: "chat.completion" }],
  },
  "POST /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    model: "gpt-4o",
    choices: [],
  },
  "DELETE /chat/completions/": {
    id: "chatcmpl-mock123",
    object: "chat.completion",
    deleted: true,
  },
  "POST /embeddings": {
    object: "list",
    model: "text-embedding-3-small",
    data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
    usage: { prompt_tokens: 5, total_tokens: 5 },
  },
  "POST /moderations": {
    id: "modr-mock123",
    model: "omni-moderation-latest",
    results: [{ flagged: false, categories: {}, category_scores: {} }],
  },
  "POST /completions": {
    id: "cmpl-mock123",
    object: "text_completion",
    model: "gpt-3.5-turbo-instruct",
    choices: [{ text: "Hello!", index: 0, finish_reason: "stop" }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
  },
};

function findMockResponse(method: string, url: string): any {
  // Try exact match first
  const exact = MOCK_RESPONSES[`${method} ${url}`];
  if (exact) return exact;

  // Try prefix match for resource/{id} patterns
  for (const [key, value] of Object.entries(MOCK_RESPONSES)) {
    const [keyMethod, keyPath] = key.split(" ", 2);
    if (keyMethod === method && keyPath.endsWith("/") && url.startsWith(keyPath)) {
      return value;
    }
  }

  return null;
}

beforeAll(async () => {
  mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const response = findMockResponse(req.method!, req.url!);
      if (response) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `No mock for ${req.method} ${req.url}` }));
      }
    });
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, "127.0.0.1", () => {
      const addr = mockServer.address() as { port: number };
      mockBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => mockServer.close(() => resolve()));
});

// ---- Build a mock OpenAIClient that hits our mock server ----

function createMockClient(): OpenAIClient {
  return {
    async request(method: string, path: string, body?: Record<string, unknown>) {
      const opts: RequestInit = {
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };
      if (body && method.toUpperCase() === "POST") {
        opts.body = JSON.stringify(body);
      }
      const url = method.toUpperCase() === "GET" && body
        ? `${mockBaseUrl}${path}?${new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString()}`
        : `${mockBaseUrl}${path}`;
      const response = await fetch(url, opts);
      if (!response.ok) {
        throw new Error(`Mock server: ${response.status}`);
      }
      return response.json();
    },
  };
}

const allFragments = [
  openaiInterpreter,
  errorInterpreter,
  fiberInterpreter,
  coreInterpreter,
  numInterpreter,
  strInterpreter,
];

const app = ilo(num, str, openaiPlugin({ apiKey: "sk-test-fake" }), fiber, error);

async function run(prog: { ast: any }, input: Record<string, unknown> = {}) {
  const ast = injectInput(prog.ast, input);
  const client = createMockClient();
  const evaluate = serverEvaluate(client, allFragments);
  return await evaluate(ast.result);
}

// ============================================================
// Chat Completions
// ============================================================

describe("openai integration: chat completions", () => {
  it("create chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
    expect(result.id).toBeDefined();
    expect(result.choices).toBeDefined();
  });

  it("retrieve chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.retrieve("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("list chat completions", async () => {
    const prog = app(($) => $.openai.chat.completions.list({ model: "gpt-4o" }));
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("update chat completion", async () => {
    const prog = app(($) =>
      $.openai.chat.completions.update("chatcmpl-mock123", { metadata: { key: "val" } }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("chat.completion");
  });

  it("delete chat completion", async () => {
    const prog = app(($) => $.openai.chat.completions.delete("chatcmpl-mock123"));
    const result = (await run(prog)) as any;
    expect(result.deleted).toBe(true);
  });
});

// ============================================================
// Embeddings
// ============================================================

describe("openai integration: embeddings", () => {
  it("create embedding", async () => {
    const prog = app(($) =>
      $.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("list");
    expect(result.data[0].object).toBe("embedding");
    expect(Array.isArray(result.data[0].embedding)).toBe(true);
  });
});

// ============================================================
// Moderations
// ============================================================

describe("openai integration: moderations", () => {
  it("create moderation", async () => {
    const prog = app(($) =>
      $.openai.moderations.create({
        model: "omni-moderation-latest",
        input: "some text to moderate",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
    expect(result.results[0].flagged).toBe(false);
  });
});

// ============================================================
// Legacy Completions
// ============================================================

describe("openai integration: legacy completions", () => {
  it("create completion", async () => {
    const prog = app(($) =>
      $.openai.completions.create({
        model: "gpt-3.5-turbo-instruct",
        prompt: "Say hello",
      }),
    );
    const result = (await run(prog)) as any;
    expect(result.object).toBe("text_completion");
    expect(result.choices[0].text).toBeDefined();
  });
});

// ============================================================
// Composition: error + openai
// ============================================================

describe("composition: error + openai", () => {
  it("$.attempt wraps successful openai call", async () => {
    const prog = app(($) =>
      $.attempt(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
      ),
    );
    const result = (await run(prog)) as any;
    expect(result.ok).not.toBeNull();
    expect(result.err).toBeNull();
  });
});

// ============================================================
// Composition: fiber + openai
// ============================================================

describe("composition: fiber + openai", () => {
  it("$.par runs two openai calls in parallel", async () => {
    const prog = app(($) =>
      $.par(
        $.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
        $.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: "test",
        }),
      ),
    );
    const result = (await run(prog)) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].object).toBe("chat.completion");
    expect(result[1].object).toBe("list");
  });
});

// ============================================================
// Chaining: create completion then use result in moderation
// ============================================================

describe("openai integration: chaining", () => {
  it("create completion then moderate its output", async () => {
    const prog = app(($) => {
      const completion = $.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      });
      return $.openai.moderations.create({
        input: (completion as any).choices,
      });
    });
    const result = (await run(prog)) as any;
    expect(result.results).toBeDefined();
  });
});
```

**Step 2: Run the integration tests**

Run: `npm test -- --run tests/plugins/openai/6.21.0/integration.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add tests/plugins/openai/6.21.0/integration.test.ts
git commit -m "feat(openai): add integration tests with mock HTTP server (#48)"
```

---

### Task 8: Full validation and final commit

**Step 1: Run the full build pipeline**

Run: `npm run build && npm run check && npm test`
Expected: ALL PASS, no type errors, no lint errors.

**Step 2: Verify no regressions**

Run: `npm test -- --run`
Expected: All existing tests (stripe, postgres, core, etc.) still pass.

**Step 3: Final commit (if any remaining changes)**

If there are any formatting fixes from lint:

```bash
git add -A
git commit -m "chore(openai): formatting fixes (#48)"
```

---

### Task 9: Create PR

Create PR against main with:
- Title: `feat: add openai plugin (openai-node v6.21.0) (#48)`
- Body referencing `Closes #48`
- Design alignment with VISION.md
- Validation performed

```bash
gh pr create --title "feat: add openai plugin (openai-node v6.21.0)" --body "$(cat <<'EOF'
Closes #48

## What this does

Implements the `openai` plugin wrapping openai-node v6.21.0 for AI text operations.
8 node kinds covering chat completions (create/retrieve/list/update/delete),
embeddings, moderations, and legacy completions. Follows the Stripe plugin pattern
with uniform `openai/api_call` effect type.

## Design alignment

- **1:1 SDK shape**: `$.openai.chat.completions.create(...)` mirrors `openai.chat.completions.create(...)`
- **Plugin contract**: 3 required fields (name, nodeKinds, build), config factory
- **AST self-contained**: Config baked into every node
- **Honest assessment**: Streaming and auto-pagination documented as "can't model"

## Validation performed

- `npm run build` — no type errors
- `npm run check` — no lint errors
- `npm test` — all tests pass (index, interpreter, integration)
EOF
)"
```
