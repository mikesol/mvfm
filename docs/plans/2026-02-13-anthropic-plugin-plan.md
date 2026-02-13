# Anthropic Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `anthropic` plugin wrapping `@anthropic-ai/sdk@0.74.0` with 9 operations covering messages, batches, and models.

**Architecture:** External-service plugin following the stripe pattern — configured factory function, uniform `anthropic/api_call` effect type, all request-response. Files: `index.ts`, `interpreter.ts`, `handler.server.ts`, `handler.client.ts`, `client-anthropic-sdk.ts`.

**Tech Stack:** TypeScript, vitest, @anthropic-ai/sdk

**Design doc:** `docs/plans/2026-02-13-anthropic-plugin-design.md`

---

### Task 1: Create worktree and directory structure

**Files:**
- Create: `src/plugins/anthropic/0.74.0/` (directory)
- Create: `tests/plugins/anthropic/0.74.0/` (directory)

**Step 1: Assign issue and create worktree**

```bash
gh issue edit 50 --add-assignee @me --remove-label ready --add-label in-progress
git worktree add ../ilo-50 -b issue-50
cd ../ilo-50
```

**Step 2: Create directories**

```bash
mkdir -p src/plugins/anthropic/0.74.0
mkdir -p tests/plugins/anthropic/0.74.0
```

**Step 3: Commit**

```bash
git add -A
git commit --allow-empty -m "chore: scaffold anthropic plugin directory structure (#50)"
```

---

### Task 2: Plugin definition (`index.ts`)

**Files:**
- Create: `src/plugins/anthropic/0.74.0/index.ts`
- Test: `tests/plugins/anthropic/0.74.0/index.test.ts`

**Step 1: Write the AST construction tests**

Create `tests/plugins/anthropic/0.74.0/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { anthropic } from "../../../../src/plugins/anthropic/0.74.0";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, anthropic({ apiKey: "sk-ant-test-123" }));

// ============================================================
// Messages
// ============================================================

describe("anthropic: messages.create", () => {
  it("produces anthropic/create_message node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("accepts Expr params", () => {
    const prog = app(($) => {
      return $.anthropic.messages.create({
        model: $.input.model,
        max_tokens: $.input.maxTokens,
        messages: $.input.messages,
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message");
    expect(ast.result.params.fields.model.kind).toBe("core/prop_access");
  });
});

describe("anthropic: messages.countTokens", () => {
  it("produces anthropic/count_tokens node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-5-20250929",
        messages: [{ role: "user", content: "Hello" }],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/count_tokens");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

// ============================================================
// Batches
// ============================================================

describe("anthropic: messages.batches.create", () => {
  it("produces anthropic/create_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.create({
        requests: [
          {
            custom_id: "req-1",
            params: {
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 1024,
              messages: [{ role: "user", content: "Hello" }],
            },
          },
        ],
      });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/create_message_batch");
    expect(ast.result.params.kind).toBe("core/record");
  });
});

describe("anthropic: messages.batches.retrieve", () => {
  it("produces anthropic/retrieve_message_batch node with literal id", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.retrieve("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });

  it("accepts Expr<string> id", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.retrieve($.input.batchId);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_message_batch");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});

describe("anthropic: messages.batches.list", () => {
  it("produces anthropic/list_message_batches node with params", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.list({ limit: 20 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_message_batches");
    expect(ast.result.params.kind).toBe("core/record");
    expect(ast.result.params.fields.limit.value).toBe(20);
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_message_batches");
    expect(ast.result.params).toBeNull();
  });
});

describe("anthropic: messages.batches.delete", () => {
  it("produces anthropic/delete_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.delete("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/delete_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });
});

describe("anthropic: messages.batches.cancel", () => {
  it("produces anthropic/cancel_message_batch node", () => {
    const prog = app(($) => {
      return $.anthropic.messages.batches.cancel("msgbatch_123");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/cancel_message_batch");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("msgbatch_123");
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic: models.retrieve", () => {
  it("produces anthropic/retrieve_model node", () => {
    const prog = app(($) => {
      return $.anthropic.models.retrieve("claude-sonnet-4-5-20250929");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_model");
    expect(ast.result.id.kind).toBe("core/literal");
    expect(ast.result.id.value).toBe("claude-sonnet-4-5-20250929");
  });
});

describe("anthropic: models.list", () => {
  it("produces anthropic/list_models node with params", () => {
    const prog = app(($) => {
      return $.anthropic.models.list({ limit: 10 });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_models");
    expect(ast.result.params.kind).toBe("core/record");
  });

  it("optional params are null when omitted", () => {
    const prog = app(($) => {
      return $.anthropic.models.list();
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/list_models");
    expect(ast.result.params).toBeNull();
  });
});

// ============================================================
// Integration with $.do()
// ============================================================

describe("anthropic: integration with $.do()", () => {
  it("side-effecting operations wrapped in $.do() are reachable", () => {
    expect(() => {
      app(($) => {
        const msg = $.anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          messages: [{ role: "user", content: "Hello" }],
        });
        const count = $.anthropic.messages.countTokens({
          model: "claude-sonnet-4-5-20250929",
          messages: [{ role: "user", content: "Hello" }],
        });
        return $.do(msg, count);
      });
    }).not.toThrow();
  });
});

describe("anthropic: cross-operation dependencies", () => {
  it("can use result of one operation as input to another", () => {
    const prog = app(($) => {
      const batch = $.anthropic.messages.batches.create({
        requests: [
          {
            custom_id: "req-1",
            params: {
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 1024,
              messages: [{ role: "user", content: "Hello" }],
            },
          },
        ],
      });
      return $.anthropic.messages.batches.retrieve(batch.id);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("anthropic/retrieve_message_batch");
    expect(ast.result.id.kind).toBe("core/prop_access");
  });
});
```

**Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/plugins/anthropic/0.74.0/index.test.ts
```

Expected: FAIL — cannot find module `src/plugins/anthropic/0.74.0`

**Step 3: Write the plugin definition**

Create `src/plugins/anthropic/0.74.0/index.ts`:

```ts
// ============================================================
// ILO PLUGIN: anthropic (@anthropic-ai/sdk compatible API)
// ============================================================
//
// Implementation status: COMPLETE (9 of 9 modelable operations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - Messages: create (non-streaming), countTokens
//   - Message Batches: create, retrieve, list, delete, cancel
//   - Models: retrieve, list
//
// Not doable (fundamental mismatch with AST model):
//   - messages.create() with stream: true — SSE, no request-response shape
//   - messages.stream() — streaming wrapper
//   - messages.parse() — client-side Zod parsing, not an API operation
//   - messages.batches.results() — JSONL streaming
//
// Not modeled (deprecated/unstable):
//   - completions.create() — legacy, deprecated
//   - beta.* — unstable surface (files, skills)
//
// ============================================================
//
// Goal: An LLM that knows @anthropic-ai/sdk should be able to
// write Ilo programs with near-zero learning curve. The API
// mirrors the real SDK: client.messages.create(...) becomes
// $.anthropic.messages.create(...).
//
// Real @anthropic-ai/sdk API (v0.74.0):
//   const client = new Anthropic({ apiKey: '...' })
//   const msg = await client.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//   const count = await client.messages.countTokens({ model: '...', messages: [...] })
//   const batch = await client.messages.batches.create({ requests: [...] })
//   const batch = await client.messages.batches.retrieve('msgbatch_...')
//   const batches = await client.messages.batches.list({ limit: 20 })
//   await client.messages.batches.delete('msgbatch_...')
//   const batch = await client.messages.batches.cancel('msgbatch_...')
//   const model = await client.models.retrieve('claude-sonnet-4-5-20250929')
//   const models = await client.models.list()
//
// Based on source-level analysis of @anthropic-ai/sdk v0.74.0
// (npm package extracted and read). The SDK is Stainless-generated,
// using post/get/delete methods on the client that map directly
// to REST endpoints.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Anthropic operations added to the DSL context by the anthropic plugin.
 *
 * Mirrors the @anthropic-ai/sdk API: messages (create, countTokens),
 * message batches (CRUD), and models (retrieve, list).
 */
export interface AnthropicMethods {
  /** Anthropic API operations, namespaced under `$.anthropic`. */
  anthropic: {
    messages: {
      /** Create a message (non-streaming). */
      create(
        params: Expr<Record<string, unknown>> | Record<string, unknown>,
      ): Expr<Record<string, unknown>>;
      /** Count tokens for a message without creating it. */
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
        /** List message batches with optional query params. */
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
      /** Retrieve model info by ID. */
      retrieve(id: Expr<string> | string): Expr<Record<string, unknown>>;
      /** List available models with optional query params. */
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
 * Requires an API key. Optionally accepts a baseURL for custom endpoints.
 */
export interface AnthropicConfig {
  /** Anthropic API key (e.g. `sk-ant-api03-...`). */
  apiKey: string;
  /** Base URL override (defaults to `https://api.anthropic.com`). */
  baseURL?: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Anthropic plugin factory. Namespace: `anthropic/`.
 *
 * Creates a plugin that exposes messages, batches, and models
 * resource methods for building Anthropic API call AST nodes.
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
      function resolveId(id: Expr<string> | string) {
        return ctx.isExpr(id) ? id.__node : ctx.lift(id).__node;
      }

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
// 1. Non-streaming message creation:
//    Real:  const msg = await client.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//    Ilo:   const msg = $.anthropic.messages.create({ model: '...', max_tokens: 1024, messages: [...] })
//    Nearly identical. Only difference is $ prefix and no await.
//
// 2. Token counting:
//    Real:  const count = await client.messages.countTokens({ model: '...', messages: [...] })
//    Ilo:   const count = $.anthropic.messages.countTokens({ model: '...', messages: [...] })
//    1:1 mapping.
//
// 3. Batch operations:
//    Real:  const batch = await client.messages.batches.create({ requests: [...] })
//    Ilo:   const batch = $.anthropic.messages.batches.create({ requests: [...] })
//    Nested resource pattern maps directly.
//
// 4. Cross-operation dependencies:
//    const batch = $.anthropic.messages.batches.create({ requests: [...] })
//    const status = $.anthropic.messages.batches.retrieve(batch.id)
//    Proxy chains capture dependencies perfectly.
//
// WORKS BUT DIFFERENT:
//
// 5. Return types:
//    Real SDK has typed responses (Message, MessageTokensCount, etc.)
//    Ilo uses Record<string, unknown>. Property access works via proxy
//    but no IDE autocomplete for Anthropic-specific fields.
//
// DOESN'T WORK / NOT MODELED:
//
// 6. Streaming:
//    Real:  const stream = client.messages.stream({ ... })
//    Ilo:   Can't model SSE/async iterators. Only non-streaming create.
//
// 7. Structured output (parse):
//    Real:  const msg = await client.messages.parse({ ..., output_config: { format: zodOutputFormat(...) } })
//    Ilo:   Not modeled. parse() is a client-side Zod wrapper over create().
//
// 8. Batch results streaming:
//    Real:  for await (const result of client.messages.batches.results('...')) { ... }
//    Ilo:   Not modeled. JSONL streaming.
//
// ============================================================
```

**Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/plugins/anthropic/0.74.0/index.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/anthropic/0.74.0/index.ts tests/plugins/anthropic/0.74.0/index.test.ts
git commit -m "feat(anthropic): add plugin definition with 9 operations (#50)"
```

---

### Task 3: Interpreter (`interpreter.ts`)

**Files:**
- Create: `src/plugins/anthropic/0.74.0/interpreter.ts`
- Test: `tests/plugins/anthropic/0.74.0/interpreter.test.ts`

**Step 1: Write the interpreter tests**

Create `tests/plugins/anthropic/0.74.0/interpreter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { anthropic } from "../../../../src/plugins/anthropic/0.74.0";
import { anthropicInterpreter } from "../../../../src/plugins/anthropic/0.74.0/interpreter";

const app = ilo(num, str, anthropic({ apiKey: "sk-ant-test-123" }));
const fragments = [anthropicInterpreter, coreInterpreter];

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
    "anthropic/api_call": async (effect) => {
      captured.push(effect);
      return { id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ============================================================
// Messages
// ============================================================

describe("anthropic interpreter: create_message", () => {
  it("yields POST /v1/messages with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages");
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

describe("anthropic interpreter: count_tokens", () => {
  it("yields POST /v1/messages/count_tokens with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.countTokens({
        model: "claude-sonnet-4-5-20250929",
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/count_tokens");
    expect(captured[0].params).toEqual({
      model: "claude-sonnet-4-5-20250929",
      messages: [{ role: "user", content: "Hello" }],
    });
  });
});

// ============================================================
// Batches
// ============================================================

describe("anthropic interpreter: create_message_batch", () => {
  it("yields POST /v1/messages/batches with correct params", async () => {
    const prog = app(($) =>
      $.anthropic.messages.batches.create({
        requests: [
          {
            custom_id: "req-1",
            params: {
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 1024,
              messages: [{ role: "user", content: "Hello" }],
            },
          },
        ],
      }),
    );
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches");
  });
});

describe("anthropic interpreter: retrieve_message_batch", () => {
  it("yields GET /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.retrieve("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_message_batches", () => {
  it("yields GET /v1/messages/batches with params", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list({ limit: 20 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toEqual({ limit: 20 });
  });

  it("yields GET /v1/messages/batches with undefined params when omitted", async () => {
    const prog = app(($) => $.anthropic.messages.batches.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/messages/batches");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: delete_message_batch", () => {
  it("yields DELETE /v1/messages/batches/{id}", async () => {
    const prog = app(($) => $.anthropic.messages.batches.delete("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("DELETE");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123");
  });
});

describe("anthropic interpreter: cancel_message_batch", () => {
  it("yields POST /v1/messages/batches/{id}/cancel", async () => {
    const prog = app(($) => $.anthropic.messages.batches.cancel("msgbatch_123"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("POST");
    expect(captured[0].path).toBe("/v1/messages/batches/msgbatch_123/cancel");
  });
});

// ============================================================
// Models
// ============================================================

describe("anthropic interpreter: retrieve_model", () => {
  it("yields GET /v1/models/{id}", async () => {
    const prog = app(($) => $.anthropic.models.retrieve("claude-sonnet-4-5-20250929"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models/claude-sonnet-4-5-20250929");
    expect(captured[0].params).toBeUndefined();
  });
});

describe("anthropic interpreter: list_models", () => {
  it("yields GET /v1/models with params", async () => {
    const prog = app(($) => $.anthropic.models.list({ limit: 10 }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("anthropic/api_call");
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models");
    expect(captured[0].params).toEqual({ limit: 10 });
  });

  it("yields GET /v1/models with undefined params when omitted", async () => {
    const prog = app(($) => $.anthropic.models.list());
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe("GET");
    expect(captured[0].path).toBe("/v1/models");
    expect(captured[0].params).toBeUndefined();
  });
});

// ============================================================
// Input resolution
// ============================================================

describe("anthropic interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ model: "string", maxTokens: "number" }, ($) =>
      $.anthropic.messages.create({
        model: $.input.model,
        max_tokens: $.input.maxTokens,
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { captured } = await run(prog, {
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 2048,
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].params.model).toBe("claude-sonnet-4-5-20250929");
    expect(captured[0].params.max_tokens).toBe(2048);
  });
});

// ============================================================
// Return value
// ============================================================

describe("anthropic interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) =>
      $.anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello" }],
      }),
    );
    const { result } = await run(prog);
    expect(result).toEqual({ id: "mock_id", type: "message", model: "claude-sonnet-4-5-20250929" });
  });
});
```

**Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/plugins/anthropic/0.74.0/interpreter.test.ts
```

Expected: FAIL — cannot find module `interpreter`

**Step 3: Write the interpreter**

Create `src/plugins/anthropic/0.74.0/interpreter.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Anthropic client interface consumed by the anthropic handler.
 *
 * Abstracts over the actual Anthropic SDK so handlers can be
 * tested with mock clients.
 */
export interface AnthropicClient {
  /** Execute an Anthropic API request and return the parsed response. */
  request(method: string, path: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Generator-based interpreter fragment for anthropic plugin nodes.
 *
 * Yields `anthropic/api_call` effects for all 9 operations. Each effect
 * contains the HTTP method, API path, and optional params matching the
 * Anthropic REST API conventions.
 */
export const anthropicInterpreter: InterpreterFragment = {
  pluginName: "anthropic",
  canHandle: (node) => node.kind.startsWith("anthropic/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      // ---- Messages ----

      case "anthropic/create_message": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages",
          params,
        };
      }

      case "anthropic/count_tokens": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages/count_tokens",
          params,
        };
      }

      // ---- Message Batches ----

      case "anthropic/create_message_batch": {
        const params = yield { type: "recurse", child: node.params as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: "/v1/messages/batches",
          params,
        };
      }

      case "anthropic/retrieve_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: `/v1/messages/batches/${id}`,
        };
      }

      case "anthropic/list_message_batches": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: "/v1/messages/batches",
          ...(params !== undefined ? { params } : {}),
        };
      }

      case "anthropic/delete_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "DELETE",
          path: `/v1/messages/batches/${id}`,
        };
      }

      case "anthropic/cancel_message_batch": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "POST",
          path: `/v1/messages/batches/${id}/cancel`,
        };
      }

      // ---- Models ----

      case "anthropic/retrieve_model": {
        const id = yield { type: "recurse", child: node.id as ASTNode };
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: `/v1/models/${id}`,
        };
      }

      case "anthropic/list_models": {
        const params =
          node.params != null
            ? yield { type: "recurse", child: node.params as ASTNode }
            : undefined;
        return yield {
          type: "anthropic/api_call",
          method: "GET",
          path: "/v1/models",
          ...(params !== undefined ? { params } : {}),
        };
      }

      default:
        throw new Error(`Anthropic interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/plugins/anthropic/0.74.0/interpreter.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/plugins/anthropic/0.74.0/interpreter.ts tests/plugins/anthropic/0.74.0/interpreter.test.ts
git commit -m "feat(anthropic): add interpreter with uniform api_call effect (#50)"
```

---

### Task 4: Server handler and SDK adapter

**Files:**
- Create: `src/plugins/anthropic/0.74.0/handler.server.ts`
- Create: `src/plugins/anthropic/0.74.0/client-anthropic-sdk.ts`

**Step 1: Write the server handler**

Create `src/plugins/anthropic/0.74.0/handler.server.ts`:

```ts
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { AnthropicClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Anthropic effects
 * against a real Anthropic client.
 *
 * Handles `anthropic/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: AnthropicClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "anthropic/api_call") {
      const { method, path, params } = effect as {
        type: "anthropic/api_call";
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * an Anthropic client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: AnthropicClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Write the SDK adapter**

Create `src/plugins/anthropic/0.74.0/client-anthropic-sdk.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { AnthropicClient } from "./interpreter";

/**
 * Wraps the official Anthropic SDK into an {@link AnthropicClient}.
 *
 * Uses the SDK's internal post/get/delete methods to send requests.
 * POST requests send params as body. GET requests encode params as
 * query string parameters. DELETE requests have no params.
 *
 * @param client - A configured Anthropic SDK instance.
 * @returns An {@link AnthropicClient} adapter.
 */
export function wrapAnthropicSdk(client: Anthropic): AnthropicClient {
  return {
    async request(
      method: string,
      path: string,
      params?: Record<string, unknown>,
    ): Promise<unknown> {
      const upperMethod = method.toUpperCase();

      if (upperMethod === "POST") {
        return client.post(path, { body: params ?? undefined });
      }

      if (upperMethod === "DELETE") {
        return client.delete(path);
      }

      // GET: encode params as query string
      let finalPath = path;
      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ).toString();
        finalPath = `${path}?${qs}`;
      }
      return client.get(finalPath);
    },
  };
}
```

**Step 3: Verify build passes**

```bash
npm run build
```

Expected: PASS (note: `@anthropic-ai/sdk` is a type-only import in the adapter, the real SDK is a peerDependency)

**Step 4: Commit**

```bash
git add src/plugins/anthropic/0.74.0/handler.server.ts src/plugins/anthropic/0.74.0/client-anthropic-sdk.ts
git commit -m "feat(anthropic): add server handler and SDK adapter (#50)"
```

---

### Task 5: Client handler

**Files:**
- Create: `src/plugins/anthropic/0.74.0/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/anthropic/0.74.0/handler.client.ts`. This follows the exact same pattern as the stripe client handler — it's plugin-agnostic.

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

**Step 2: Verify build passes**

```bash
npm run build
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/anthropic/0.74.0/handler.client.ts
git commit -m "feat(anthropic): add client handler for browser-side execution (#50)"
```

---

### Task 6: Public exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Add anthropic exports to `src/index.ts`**

Add the following export block after the stripe exports (before the schema exports), following the same pattern as stripe:

```ts
export type { AnthropicConfig, AnthropicMethods } from "./plugins/anthropic/0.74.0";
export { anthropic } from "./plugins/anthropic/0.74.0";
export { wrapAnthropicSdk } from "./plugins/anthropic/0.74.0/client-anthropic-sdk";
export type {
  ClientHandlerOptions as AnthropicClientHandlerOptions,
  ClientHandlerState as AnthropicClientHandlerState,
} from "./plugins/anthropic/0.74.0/handler.client";
export { clientHandler as anthropicClientHandler } from "./plugins/anthropic/0.74.0/handler.client";
export {
  serverEvaluate as anthropicServerEvaluate,
  serverHandler as anthropicServerHandler,
} from "./plugins/anthropic/0.74.0/handler.server";
export type { AnthropicClient } from "./plugins/anthropic/0.74.0/interpreter";
export { anthropicInterpreter } from "./plugins/anthropic/0.74.0/interpreter";
```

**Step 2: Verify build and all tests pass**

```bash
npm run build && npm run check && npm test
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(anthropic): add public exports (#50)"
```

---

### Task 7: Create PR

**Step 1: Push and create PR**

```bash
git push -u origin issue-50
gh pr create --title "feat: anthropic plugin (@anthropic-ai/sdk v0.74.0)" --body "$(cat <<'EOF'
## Summary

- Implements the `anthropic` plugin wrapping `@anthropic-ai/sdk@0.74.0`
- 9 operations: messages.create, countTokens, batches (create/retrieve/list/delete/cancel), models (retrieve/list)
- Uniform `anthropic/api_call` effect type — same pattern as stripe
- Full test coverage: AST construction + interpreter effect tests

Closes #50

## Design alignment

- Follows `docs/plugin-authoring-guide.md` exactly: configured factory function, namespaced node kinds, `Expr<T> | T` parameters, config baked into AST nodes
- Source-level analysis performed on `@anthropic-ai/sdk@0.74.0` (npm package)
- Honest assessment in `index.ts` header documents what works, what doesn't (streaming, parse, batch results)

## Validation performed

- `npm run build` — passes
- `npm run check` — passes
- `npm test` — all tests pass
- AST construction tests verify correct node kinds and parameter lifting
- Interpreter tests verify correct HTTP method, path, and params for all 9 operations

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 2: Wait for CI**

```bash
gh pr checks --watch
```
