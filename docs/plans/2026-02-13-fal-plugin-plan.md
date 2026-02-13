# fal Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `fal` external-service plugin wrapping `@fal-ai/client` v1.9.1 for AI media generation.

**Architecture:** Follows the exact same 5-file pattern as the stripe plugin. Single `fal/api_call` effect type for direct calls and queue ops, plus a `fal/subscribe` effect for the composite subscribe flow. Config (credentials) baked into AST nodes.

**Tech Stack:** TypeScript, vitest, `@fal-ai/client` v1.9.1

**Design doc:** `docs/plans/2026-02-13-fal-plugin-design.md`

---

### Task 1: Create directory structure and plugin definition (`index.ts`)

**Files:**
- Create: `src/plugins/fal/1.9.1/index.ts`
- Test: `tests/plugins/fal/1.9.1/index.test.ts`

**Step 1: Create the test file with failing tests**

Create `tests/plugins/fal/1.9.1/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ilo } from "../../../../src/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { fal } from "../../../../src/plugins/fal/1.9.1";

function strip(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (k, v) => (k === "__id" || k === "config" ? undefined : v)),
  );
}

const app = ilo(num, str, fal({ credentials: "key_test_123" }));

// ---- fal.run ----

describe("fal: run", () => {
  it("produces fal/run node with literal input", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.endpointId.value).toBe("fal-ai/flux/dev");
    expect(ast.result.input.kind).toBe("core/record");
    expect(ast.result.input.fields.prompt.value).toBe("a cat");
  });

  it("accepts Expr input values", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev", { input: { prompt: $.input.prompt } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.input.fields.prompt.kind).toBe("core/prop_access");
  });

  it("optional options are null when omitted", () => {
    const prog = app(($) => {
      return $.fal.run("fal-ai/flux/dev");
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/run");
    expect(ast.result.input).toBeNull();
  });
});

// ---- fal.subscribe ----

describe("fal: subscribe", () => {
  it("produces fal/subscribe node", () => {
    const prog = app(($) => {
      return $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/subscribe");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.input.kind).toBe("core/record");
  });
});

// ---- fal.queue.submit ----

describe("fal: queue.submit", () => {
  it("produces fal/queue_submit node", () => {
    const prog = app(($) => {
      return $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_submit");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.input.kind).toBe("core/record");
  });
});

// ---- fal.queue.status ----

describe("fal: queue.status", () => {
  it("produces fal/queue_status node with literal requestId", () => {
    const prog = app(($) => {
      return $.fal.queue.status("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_status");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
    expect(ast.result.requestId.value).toBe("req_123");
  });

  it("accepts Expr requestId from queue.submit result", () => {
    const prog = app(($) => {
      const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
      return $.fal.queue.status("fal-ai/flux/dev", { requestId: queued.request_id });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_status");
    expect(ast.result.requestId.kind).toBe("core/prop_access");
  });
});

// ---- fal.queue.result ----

describe("fal: queue.result", () => {
  it("produces fal/queue_result node", () => {
    const prog = app(($) => {
      return $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_result");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
  });
});

// ---- fal.queue.cancel ----

describe("fal: queue.cancel", () => {
  it("produces fal/queue_cancel node", () => {
    const prog = app(($) => {
      return $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_cancel");
    expect(ast.result.endpointId.kind).toBe("core/literal");
    expect(ast.result.requestId.kind).toBe("core/literal");
  });
});

// ---- cross-operation dependencies ----

describe("fal: cross-operation dependencies", () => {
  it("can chain queue.submit result into queue.result", () => {
    const prog = app(($) => {
      const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
      return $.fal.queue.result("fal-ai/flux/dev", { requestId: queued.request_id });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("fal/queue_result");
    expect(ast.result.requestId.kind).toBe("core/prop_access");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/plugins/fal/1.9.1/index.test.ts`
Expected: FAIL — cannot find module `../../../../src/plugins/fal/1.9.1`

**Step 3: Write the plugin definition**

Create `src/plugins/fal/1.9.1/index.ts`:

```typescript
// ============================================================
// ILO PLUGIN: fal (@fal-ai/client)
// ============================================================
//
// Implementation status: PARTIAL (6 of ~10 modelable operations)
// Plugin size: SMALL — fully implemented modulo known limitations
//
// Implemented:
//   - run: direct synchronous endpoint execution
//   - subscribe: queue-based execution (submit + poll + result)
//   - queue.submit: submit request to queue
//   - queue.status: check queue request status
//   - queue.result: retrieve queue request result
//   - queue.cancel: cancel queued request
//
// Not doable (fundamental mismatch with AST model):
//   - stream: SSE push-based streaming (returns FalStream with
//     async iterator). No finite AST shape.
//   - realtime.connect: WebSocket bidirectional connection with
//     state machine. Fundamentally incompatible with request-response AST.
//   - storage.transformInput: recursive Blob-to-URL transformation
//     of arbitrary input. Runtime concern.
//
// Deferred (modelable but not in scope):
//   - storage.upload: Blob upload returning URL. Could be added
//     as a 7th node kind for image-to-image workflows.
//
// ============================================================
//
// Goal: An LLM that knows @fal-ai/client should be able to write
// Ilo programs with near-zero learning curve. The API should
// look like the real fal client as closely as possible.
//
// Real @fal-ai/client API (v1.9.1):
//   const fal = createFalClient({ credentials: "key_..." });
//   const result = await fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } });
//   const result = await fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } });
//   const { request_id } = await fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } });
//   const status = await fal.queue.status("fal-ai/flux/dev", { requestId: "req_123" });
//   const result = await fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" });
//   await fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" });
//
// Based on source-level analysis of @fal-ai/client
// (github.com/fal-ai/fal-js, libs/client/src/).
// The SDK uses createFalClient() returning a FalClient with
// run/subscribe/queue/stream/realtime/storage subsystems.
// run() dispatches via dispatchRequest() to https://fal.run/{endpoint}.
// subscribe() wraps queue.submit + queue.subscribeToStatus + queue.result.
// queue operations use the "queue" subdomain.
//
// ============================================================

import type { Expr, PluginContext, PluginDefinition } from "../../../core";

// ---- What the plugin adds to $ ----------------------------

/**
 * Fal operations added to the DSL context by the fal plugin.
 *
 * Mirrors the @fal-ai/client API: run, subscribe, and queue
 * operations for AI media generation endpoints.
 */
/** Options for run/subscribe/queue.submit — mirrors real SDK RunOptions. */
export type FalRunOptions = {
  input?: Expr<Record<string, unknown>> | Record<string, unknown>;
};

/** Options for queue.status/result/cancel — mirrors real SDK QueueStatusOptions. */
export type FalQueueOptions = {
  requestId: Expr<string> | string;
};

export interface FalMethods {
  /** Fal API operations, namespaced under `$.fal`. */
  fal: {
    /** Run an endpoint synchronously. Mirrors `fal.run(endpointId, { input })`. */
    run(
      endpointId: Expr<string> | string,
      options?: FalRunOptions,
    ): Expr<Record<string, unknown>>;
    /** Subscribe to an endpoint (queue submit + poll + result). Mirrors `fal.subscribe(endpointId, { input })`. */
    subscribe(
      endpointId: Expr<string> | string,
      options?: FalRunOptions,
    ): Expr<Record<string, unknown>>;
    queue: {
      /** Submit a request to the queue. Mirrors `fal.queue.submit(endpointId, { input })`. */
      submit(
        endpointId: Expr<string> | string,
        options?: FalRunOptions,
      ): Expr<Record<string, unknown>>;
      /** Check the status of a queued request. Mirrors `fal.queue.status(endpointId, { requestId })`. */
      status(
        endpointId: Expr<string> | string,
        options: FalQueueOptions,
      ): Expr<Record<string, unknown>>;
      /** Retrieve the result of a completed queued request. Mirrors `fal.queue.result(endpointId, { requestId })`. */
      result(
        endpointId: Expr<string> | string,
        options: FalQueueOptions,
      ): Expr<Record<string, unknown>>;
      /** Cancel a queued request. Mirrors `fal.queue.cancel(endpointId, { requestId })`. */
      cancel(
        endpointId: Expr<string> | string,
        options: FalQueueOptions,
      ): Expr<Record<string, unknown>>;
    };
  };
}

// ---- Configuration ----------------------------------------

/**
 * Configuration for the fal plugin.
 *
 * Requires credentials (API key). Uses `FAL_KEY` env var by default
 * in the real SDK, but Ilo requires explicit config.
 */
export interface FalConfig {
  /** Fal API key (e.g. `key_...`). */
  credentials: string;
}

// ---- Plugin implementation --------------------------------

/**
 * Fal plugin factory. Namespace: `fal/`.
 *
 * Creates a plugin that exposes run, subscribe, and queue
 * methods for building parameterized fal API call AST nodes.
 *
 * @param config - A {@link FalConfig} with credentials.
 * @returns A {@link PluginDefinition} for the fal plugin.
 */
export function fal(config: FalConfig): PluginDefinition<FalMethods> {
  return {
    name: "fal",
    nodeKinds: [
      "fal/run",
      "fal/subscribe",
      "fal/queue_submit",
      "fal/queue_status",
      "fal/queue_result",
      "fal/queue_cancel",
    ],

    build(ctx: PluginContext): FalMethods {
      function resolveEndpointId(endpointId: Expr<string> | string) {
        return ctx.isExpr(endpointId) ? endpointId.__node : ctx.lift(endpointId).__node;
      }

      function resolveRequestId(requestId: Expr<string> | string) {
        return ctx.isExpr(requestId) ? requestId.__node : ctx.lift(requestId).__node;
      }

      function resolveInput(input: Expr<Record<string, unknown>> | Record<string, unknown>) {
        return ctx.lift(input).__node;
      }

      return {
        fal: {
          run(endpointId, options?) {
            const input = options?.input;
            return ctx.expr({
              kind: "fal/run",
              endpointId: resolveEndpointId(endpointId),
              input: input != null ? resolveInput(input) : null,
              config,
            });
          },

          subscribe(endpointId, options?) {
            const input = options?.input;
            return ctx.expr({
              kind: "fal/subscribe",
              endpointId: resolveEndpointId(endpointId),
              input: input != null ? resolveInput(input) : null,
              config,
            });
          },

          queue: {
            submit(endpointId, options?) {
              const input = options?.input;
              return ctx.expr({
                kind: "fal/queue_submit",
                endpointId: resolveEndpointId(endpointId),
                input: input != null ? resolveInput(input) : null,
                config,
              });
            },

            status(endpointId, options) {
              return ctx.expr({
                kind: "fal/queue_status",
                endpointId: resolveEndpointId(endpointId),
                requestId: resolveRequestId(options.requestId),
                config,
              });
            },

            result(endpointId, options) {
              return ctx.expr({
                kind: "fal/queue_result",
                endpointId: resolveEndpointId(endpointId),
                requestId: resolveRequestId(options.requestId),
                config,
              });
            },

            cancel(endpointId, options) {
              return ctx.expr({
                kind: "fal/queue_cancel",
                endpointId: resolveEndpointId(endpointId),
                requestId: resolveRequestId(options.requestId),
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
// 1. Direct execution (1:1 signature):
//    Real:  await fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Ilo:   $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Identical. Only difference is $ prefix and no await.
//
// 2. Subscribe (1:1 signature):
//    Real:  await fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Ilo:   $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Identical.
//
// 3. Queue control with proxy chains (1:1 signatures):
//    const queued = $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    const result = $.fal.queue.result("fal-ai/flux/dev", { requestId: queued.request_id })
//    Proxy chains capture the dependency graph perfectly.
//
// WORKS BUT DIFFERENT:
//
// 4. Non-modelable options silently ignored:
//    Real:  fal.run(id, { input: {...}, method: "post", abortSignal: ctrl.signal })
//    Ilo:   $.fal.run(id, { input: {...} })
//    The { input } wrapper is preserved 1:1, but runtime options
//    (method, abort, storage settings) are silently dropped.
//
// 5. Return types:
//    Real @fal-ai/client uses generic Result<OutputType<Id>> with
//    per-endpoint typed responses.
//    Ilo uses Record<string, unknown> for all return types.
//    Property access still works via proxy (result.images[0].url).
//
// 6. Subscribe callbacks:
//    Real:  fal.subscribe(id, { onQueueUpdate: (status) => ... })
//    Ilo:   Not modelable. Callbacks are runtime concerns.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Streaming (fal.stream):
//    Real:  const stream = await fal.stream(id, { input })
//           for await (const chunk of stream) { ... }
//    Ilo:   Can't model. SSE push-based, no finite AST shape.
//
// 8. Realtime (fal.realtime.connect):
//    Real:  const conn = fal.realtime.connect(app, { onResult, onError })
//           conn.send(input)
//    Ilo:   Can't model. WebSocket bidirectional, stateful.
//
// 9. Storage upload:
//    Real:  const url = await fal.storage.upload(file)
//    Ilo:   Deferred. Could be added as fal/storage_upload node kind.
//
// ============================================================
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/fal/1.9.1/index.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add src/plugins/fal/1.9.1/index.ts tests/plugins/fal/1.9.1/index.test.ts
git commit -m "feat(fal): add plugin definition and AST construction tests (#54)"
```

---

### Task 2: Interpreter (`interpreter.ts`)

**Files:**
- Create: `src/plugins/fal/1.9.1/interpreter.ts`
- Test: `tests/plugins/fal/1.9.1/interpreter.test.ts`

**Step 1: Create the test file with failing tests**

Create `tests/plugins/fal/1.9.1/interpreter.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { foldAST, ilo } from "../../../../src/core";
import { coreInterpreter } from "../../../../src/interpreters/core";
import { num } from "../../../../src/plugins/num";
import { str } from "../../../../src/plugins/str";
import { fal } from "../../../../src/plugins/fal/1.9.1";
import { falInterpreter } from "../../../../src/plugins/fal/1.9.1/interpreter";

const app = ilo(num, str, fal({ credentials: "key_test_123" }));
const fragments = [falInterpreter, coreInterpreter];

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
    "fal/api_call": async (effect) => {
      captured.push(effect);
      return { data: { images: [{ url: "https://fal.ai/mock.png" }] }, requestId: "req_mock" };
    },
    "fal/subscribe": async (effect) => {
      captured.push(effect);
      return { data: { images: [{ url: "https://fal.ai/mock.png" }] }, requestId: "req_mock" };
    },
  });
  const result = await recurse(ast.result);
  return { result, captured };
}

// ---- fal.run ----

describe("fal interpreter: run", () => {
  it("yields fal/api_call with endpointId and input", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("run");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });

  it("yields fal/api_call with undefined input when omitted", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev"));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].input).toBeUndefined();
  });
});

// ---- fal.subscribe ----

describe("fal interpreter: subscribe", () => {
  it("yields fal/subscribe with endpointId and input", async () => {
    const prog = app(($) => $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/subscribe");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });
});

// ---- fal.queue.submit ----

describe("fal interpreter: queue.submit", () => {
  it("yields fal/api_call with method queue_submit", async () => {
    const prog = app(($) => $.fal.queue.submit("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_submit");
    expect(captured[0].input).toEqual({ prompt: "a cat" });
  });
});

// ---- fal.queue.status ----

describe("fal interpreter: queue.status", () => {
  it("yields fal/api_call with method queue_status and requestId", async () => {
    const prog = app(($) => $.fal.queue.status("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_status");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- fal.queue.result ----

describe("fal interpreter: queue.result", () => {
  it("yields fal/api_call with method queue_result and requestId", async () => {
    const prog = app(($) => $.fal.queue.result("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_result");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- fal.queue.cancel ----

describe("fal interpreter: queue.cancel", () => {
  it("yields fal/api_call with method queue_cancel and requestId", async () => {
    const prog = app(($) => $.fal.queue.cancel("fal-ai/flux/dev", { requestId: "req_123" }));
    const { captured } = await run(prog);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe("fal/api_call");
    expect(captured[0].endpointId).toBe("fal-ai/flux/dev");
    expect(captured[0].method).toBe("queue_cancel");
    expect(captured[0].requestId).toBe("req_123");
  });
});

// ---- input resolution ----

describe("fal interpreter: input resolution", () => {
  it("resolves input params through recurse", async () => {
    const prog = app({ prompt: "string" }, ($) =>
      $.fal.run("fal-ai/flux/dev", { input: { prompt: $.input.prompt } }),
    );
    const { captured } = await run(prog, { prompt: "a dog" });
    expect(captured).toHaveLength(1);
    expect(captured[0].input).toEqual({ prompt: "a dog" });
  });

  it("resolves dynamic requestId through recurse", async () => {
    const prog = app({ reqId: "string" }, ($) =>
      $.fal.queue.status("fal-ai/flux/dev", { requestId: $.input.reqId }),
    );
    const { captured } = await run(prog, { reqId: "req_dynamic_456" });
    expect(captured).toHaveLength(1);
    expect(captured[0].requestId).toBe("req_dynamic_456");
  });
});

// ---- return value ----

describe("fal interpreter: return value", () => {
  it("returns the handler response as the result", async () => {
    const prog = app(($) => $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } }));
    const { result } = await run(prog);
    expect(result).toEqual({ data: { images: [{ url: "https://fal.ai/mock.png" }] }, requestId: "req_mock" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/plugins/fal/1.9.1/interpreter.test.ts`
Expected: FAIL — cannot find module `./interpreter`

**Step 3: Write the interpreter**

Create `src/plugins/fal/1.9.1/interpreter.ts`:

```typescript
import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Fal client interface consumed by the fal handler.
 *
 * Abstracts over the actual @fal-ai/client so handlers can be
 * tested with mock clients.
 */
export interface FalClient {
  /** Execute an endpoint synchronously. */
  run(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  /** Subscribe to an endpoint (queue submit + poll + result). */
  subscribe(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  /** Submit a request to the queue. */
  queueSubmit(endpointId: string, input?: Record<string, unknown>): Promise<unknown>;
  /** Check the status of a queued request. */
  queueStatus(endpointId: string, requestId: string): Promise<unknown>;
  /** Retrieve the result of a completed queued request. */
  queueResult(endpointId: string, requestId: string): Promise<unknown>;
  /** Cancel a queued request. */
  queueCancel(endpointId: string, requestId: string): Promise<void>;
}

/**
 * Generator-based interpreter fragment for fal plugin nodes.
 *
 * Yields `fal/api_call` effects for direct and queue operations,
 * and `fal/subscribe` effects for the composite subscribe flow.
 * Each effect contains the endpointId, method, and optional input/requestId.
 */
export const falInterpreter: InterpreterFragment = {
  pluginName: "fal",
  canHandle: (node) => node.kind.startsWith("fal/"),
  *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
    switch (node.kind) {
      case "fal/run": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const input =
          node.input != null
            ? yield { type: "recurse", child: node.input as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "run",
          ...(input !== undefined ? { input } : {}),
        };
      }

      case "fal/subscribe": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const input =
          node.input != null
            ? yield { type: "recurse", child: node.input as ASTNode }
            : undefined;
        return yield {
          type: "fal/subscribe",
          endpointId,
          ...(input !== undefined ? { input } : {}),
        };
      }

      case "fal/queue_submit": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const input =
          node.input != null
            ? yield { type: "recurse", child: node.input as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_submit",
          ...(input !== undefined ? { input } : {}),
        };
      }

      case "fal/queue_status": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const requestId = yield { type: "recurse", child: node.requestId as ASTNode };
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_status",
          requestId,
        };
      }

      case "fal/queue_result": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const requestId = yield { type: "recurse", child: node.requestId as ASTNode };
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_result",
          requestId,
        };
      }

      case "fal/queue_cancel": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const requestId = yield { type: "recurse", child: node.requestId as ASTNode };
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_cancel",
          requestId,
        };
      }

      default:
        throw new Error(`Fal interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/plugins/fal/1.9.1/interpreter.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add src/plugins/fal/1.9.1/interpreter.ts tests/plugins/fal/1.9.1/interpreter.test.ts
git commit -m "feat(fal): add interpreter fragment with effect-yielding tests (#54)"
```

---

### Task 3: SDK adapter (`client-fal-sdk.ts`)

**Files:**
- Create: `src/plugins/fal/1.9.1/client-fal-sdk.ts`

**Step 1: Write the SDK adapter**

Create `src/plugins/fal/1.9.1/client-fal-sdk.ts`:

```typescript
import type { FalClient as FalSdk } from "@fal-ai/client";
import type { FalClient } from "./interpreter";

/**
 * Wraps the official @fal-ai/client into a {@link FalClient}.
 *
 * Delegates to the real SDK's run, subscribe, and queue methods,
 * preserving the SDK's authentication, retries, and storage handling.
 *
 * @param client - A configured @fal-ai/client FalClient instance.
 * @returns A {@link FalClient} adapter.
 */
export function wrapFalSdk(client: FalSdk): FalClient {
  return {
    async run(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.run(endpointId, { input });
      return result;
    },

    async subscribe(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.subscribe(endpointId, { input });
      return result;
    },

    async queueSubmit(endpointId: string, input?: Record<string, unknown>): Promise<unknown> {
      const result = await client.queue.submit(endpointId, { input });
      return result;
    },

    async queueStatus(endpointId: string, requestId: string): Promise<unknown> {
      const result = await client.queue.status(endpointId, { requestId });
      return result;
    },

    async queueResult(endpointId: string, requestId: string): Promise<unknown> {
      const result = await client.queue.result(endpointId, { requestId });
      return result;
    },

    async queueCancel(endpointId: string, requestId: string): Promise<void> {
      await client.queue.cancel(endpointId, { requestId });
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/fal/1.9.1/client-fal-sdk.ts
git commit -m "feat(fal): add SDK adapter wrapping @fal-ai/client (#54)"
```

---

### Task 4: Server handler (`handler.server.ts`)

**Files:**
- Create: `src/plugins/fal/1.9.1/handler.server.ts`

**Step 1: Write the server handler**

Create `src/plugins/fal/1.9.1/handler.server.ts`:

```typescript
import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { FalClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes fal effects
 * against a real fal client.
 *
 * Handles `fal/api_call` and `fal/subscribe` effects by delegating
 * to the appropriate client method. Throws on unhandled effect types.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: FalClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "fal/api_call") {
      const { endpointId, method, input, requestId } = effect as {
        type: "fal/api_call";
        endpointId: string;
        method: string;
        input?: Record<string, unknown>;
        requestId?: string;
      };
      let value: unknown;
      switch (method) {
        case "run":
          value = await client.run(endpointId, input);
          break;
        case "queue_submit":
          value = await client.queueSubmit(endpointId, input);
          break;
        case "queue_status":
          value = await client.queueStatus(endpointId, requestId!);
          break;
        case "queue_result":
          value = await client.queueResult(endpointId, requestId!);
          break;
        case "queue_cancel":
          value = await client.queueCancel(endpointId, requestId!);
          break;
        default:
          throw new Error(`serverHandler: unknown fal method "${method}"`);
      }
      return { value, state };
    }

    if (effect.type === "fal/subscribe") {
      const { endpointId, input } = effect as {
        type: "fal/subscribe";
        endpointId: string;
        input?: Record<string, unknown>;
      };
      const value = await client.subscribe(endpointId, input);
      return { value, state };
    }

    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a fal client using the provided interpreter fragments.
 *
 * @param client - The {@link FalClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: FalClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
```

**Step 2: Commit**

```bash
git add src/plugins/fal/1.9.1/handler.server.ts
git commit -m "feat(fal): add server-side step handler (#54)"
```

---

### Task 5: Client handler (`handler.client.ts`)

**Files:**
- Create: `src/plugins/fal/1.9.1/handler.client.ts`

**Step 1: Write the client handler**

Create `src/plugins/fal/1.9.1/handler.client.ts` (identical pattern to stripe):

```typescript
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

**Step 2: Commit**

```bash
git add src/plugins/fal/1.9.1/handler.client.ts
git commit -m "feat(fal): add client-side step handler (#54)"
```

---

### Task 6: Public exports in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

**Step 1: Add fal exports**

Add the following exports to `src/index.ts` in the appropriate section (after the stripe exports):

```typescript
// ---- fal plugin ----
export type { FalConfig, FalMethods, FalRunOptions, FalQueueOptions } from "./plugins/fal/1.9.1";
export { fal } from "./plugins/fal/1.9.1";
export { wrapFalSdk } from "./plugins/fal/1.9.1/client-fal-sdk";
export type {
  ClientHandlerOptions as FalClientHandlerOptions,
  ClientHandlerState as FalClientHandlerState,
} from "./plugins/fal/1.9.1/handler.client";
export { clientHandler as falClientHandler } from "./plugins/fal/1.9.1/handler.client";
export type { FalClient } from "./plugins/fal/1.9.1/interpreter";
export { falInterpreter } from "./plugins/fal/1.9.1/interpreter";
```

**Step 2: Run build to verify exports compile**

Run: `npm run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(fal): add public exports to src/index.ts (#54)"
```

---

### Task 7: Full validation

**Step 1: Run full build + check + test suite**

Run: `npm run build && npm run check && npm test`
Expected: All pass with no errors

**Step 2: Final commit if any fixups needed**

---

### Task 8: Create PR

**Step 1: Push branch and create PR**

```bash
git push -u origin issue-54
gh pr create --title "feat: add fal plugin (@fal-ai/client v1.9.1)" --body "$(cat <<'EOF'
Closes #54

## What this does

Implements the `fal` external-service plugin wrapping `@fal-ai/client` v1.9.1 for AI media generation (image, video, audio). Models 6 operations: `run`, `subscribe`, `queue.submit`, `queue.status`, `queue.result`, `queue.cancel`.

## Design alignment

- Follows the 5-file external-service plugin structure from `docs/plugin-authoring-guide.md`
- Based on source-level analysis of @fal-ai/client (not docs)
- Honest assessment documents what works, what's different, and what can't be modeled

## Validation performed

- `npm run build` — compiles cleanly
- `npm run check` — no type errors
- `npm test` — all tests pass (AST construction + interpreter effect-yielding)

## Test plan

- [ ] AST construction tests verify all 6 node kinds produce correct AST shapes
- [ ] Interpreter tests verify correct effects are yielded with mock handlers
- [ ] Cross-operation dependency test (queue.submit → queue.result chain)
- [ ] Input resolution tests with dynamic proxy values
- [ ] Build/check/test pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
