// ============================================================
// MVFM PLUGIN: fal (@fal-ai/client)
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
// Mvfm programs with near-zero learning curve. The API should
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
    run(endpointId: Expr<string> | string, options?: FalRunOptions): Expr<Record<string, unknown>>;
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
 * in the real SDK, but Mvfm requires explicit config.
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
//    Mvfm:   $.fal.run("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Identical. Only difference is $ prefix and no await.
//
// 2. Subscribe (1:1 signature):
//    Real:  await fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } })
//    Mvfm:   $.fal.subscribe("fal-ai/flux/dev", { input: { prompt: "a cat" } })
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
//    Mvfm:   $.fal.run(id, { input: {...} })
//    The { input } wrapper is preserved 1:1, but runtime options
//    (method, abort, storage settings) are silently dropped.
//
// 5. Return types:
//    Real @fal-ai/client uses generic Result<OutputType<Id>> with
//    per-endpoint typed responses.
//    Mvfm uses Record<string, unknown> for all return types.
//    Property access still works via proxy (result.images[0].url).
//
// 6. Subscribe callbacks:
//    Real:  fal.subscribe(id, { onQueueUpdate: (status) => ... })
//    Mvfm:   Not modelable. Callbacks are runtime concerns.
//
// DOESN'T WORK / NOT MODELED:
//
// 7. Streaming (fal.stream):
//    Real:  const stream = await fal.stream(id, { input })
//           for await (const chunk of stream) { ... }
//    Mvfm:   Can't model. SSE push-based, no finite AST shape.
//
// 8. Realtime (fal.realtime.connect):
//    Real:  const conn = fal.realtime.connect(app, { onResult, onError })
//           conn.send(input)
//    Mvfm:   Can't model. WebSocket bidirectional, stateful.
//
// 9. Storage upload:
//    Real:  const url = await fal.storage.upload(file)
//    Mvfm:   Deferred. Could be added as fal/storage_upload node kind.
//
// ============================================================
