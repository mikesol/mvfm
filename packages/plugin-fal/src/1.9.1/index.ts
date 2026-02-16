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

import type { FalClient as FalSdkClient, QueueClient as FalSdkQueueClient } from "@fal-ai/client";
import type { Expr, PluginContext, PluginDefinition } from "@mvfm/core";
import { falInterpreter } from "./interpreter";

// ---- What the plugin adds to $ ----------------------------

/**
 * Fal operations added to the DSL context by the fal plugin.
 *
 * Mirrors the \@fal-ai/client API: run, subscribe, and queue
 * operations for AI media generation endpoints.
 */
type Primitive = string | number | boolean | null | undefined;

type Exprify<T> = T extends Primitive
  ? T | Expr<T>
  : T extends Array<infer U>
    ? Array<Exprify<U>> | Expr<T>
    : T extends object
      ? { [K in keyof T]: Exprify<T[K]> } | Expr<T>
      : T | Expr<T>;

type UnsupportedOptionKeys = "abortSignal";

type RunOptionsShape = Omit<Parameters<FalSdkClient["run"]>[1], UnsupportedOptionKeys>;
type SubscribeOptionsShape = Omit<Parameters<FalSdkClient["subscribe"]>[1], UnsupportedOptionKeys>;
type SubmitOptionsShape = Omit<Parameters<FalSdkQueueClient["submit"]>[1], UnsupportedOptionKeys>;
type QueueStatusOptionsShape = Omit<
  Parameters<FalSdkQueueClient["status"]>[1],
  UnsupportedOptionKeys
>;
type QueueResultOptionsShape = Omit<
  Parameters<FalSdkQueueClient["result"]>[1],
  UnsupportedOptionKeys
>;
type QueueCancelOptionsShape = Omit<
  Parameters<FalSdkQueueClient["cancel"]>[1],
  UnsupportedOptionKeys
>;

/** SDK-aligned run options, excluding unsupported runtime-only fields. */
export type FalRunOptions = Exprify<RunOptionsShape>;
/** SDK-aligned subscribe options, excluding unsupported runtime-only fields. */
export type FalSubscribeOptions = Exprify<SubscribeOptionsShape>;
/** SDK-aligned queue.submit options, excluding unsupported runtime-only fields. */
export type FalSubmitOptions = Exprify<SubmitOptionsShape>;
/** SDK-aligned queue.status options, excluding unsupported runtime-only fields. */
export type FalQueueStatusOptions = Exprify<QueueStatusOptionsShape>;
/** SDK-aligned queue.result options, excluding unsupported runtime-only fields. */
export type FalQueueResultOptions = Exprify<QueueResultOptionsShape>;
/** SDK-aligned queue.cancel options, excluding unsupported runtime-only fields. */
export type FalQueueCancelOptions = Exprify<QueueCancelOptionsShape>;

export interface FalMethods {
  /** Fal API operations, namespaced under `$.fal`. */
  fal: {
    /** Run an endpoint synchronously. Mirrors `fal.run(endpointId, { input })`. */
    run(
      endpointId: Expr<string> | string,
      options?: FalRunOptions,
    ): Expr<Awaited<ReturnType<FalSdkClient["run"]>>>;
    /** Subscribe to an endpoint (queue submit + poll + result). Mirrors `fal.subscribe(endpointId, { input })`. */
    subscribe(
      endpointId: Expr<string> | string,
      options?: FalSubscribeOptions,
    ): Expr<Awaited<ReturnType<FalSdkClient["subscribe"]>>>;
    queue: {
      /** Submit a request to the queue. Mirrors `fal.queue.submit(endpointId, { input })`. */
      submit(
        endpointId: Expr<string> | string,
        options: FalSubmitOptions,
      ): Expr<Awaited<ReturnType<FalSdkQueueClient["submit"]>>>;
      /** Check the status of a queued request. Mirrors `fal.queue.status(endpointId, { requestId })`. */
      status(
        endpointId: Expr<string> | string,
        options: FalQueueStatusOptions,
      ): Expr<Awaited<ReturnType<FalSdkQueueClient["status"]>>>;
      /** Retrieve the result of a completed queued request. Mirrors `fal.queue.result(endpointId, { requestId })`. */
      result(
        endpointId: Expr<string> | string,
        options: FalQueueResultOptions,
      ): Expr<Awaited<ReturnType<FalSdkQueueClient["result"]>>>;
      /** Cancel a queued request. Mirrors `fal.queue.cancel(endpointId, { requestId })`. */
      cancel(endpointId: Expr<string> | string, options: FalQueueCancelOptions): Expr<void>;
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
 * @returns A PluginDefinition for the fal plugin.
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
    defaultInterpreter: falInterpreter,

    build(ctx: PluginContext): FalMethods {
      function resolveEndpointId(endpointId: Expr<string> | string) {
        return ctx.isExpr(endpointId) ? endpointId.__node : ctx.lift(endpointId).__node;
      }

      function resolveOptions(options?: unknown) {
        return options != null ? ctx.lift(options as any).__node : null;
      }

      return {
        fal: {
          run(endpointId: Expr<string> | string, options?: FalRunOptions) {
            return ctx.expr<Awaited<ReturnType<FalSdkClient["run"]>>>({
              kind: "fal/run",
              endpointId: resolveEndpointId(endpointId),
              options: resolveOptions(options),
              config,
            });
          },

          subscribe(endpointId: Expr<string> | string, options?: FalSubscribeOptions) {
            return ctx.expr<Awaited<ReturnType<FalSdkClient["subscribe"]>>>({
              kind: "fal/subscribe",
              endpointId: resolveEndpointId(endpointId),
              options: resolveOptions(options),
              config,
            });
          },

          queue: {
            submit(endpointId: Expr<string> | string, options: FalSubmitOptions) {
              return ctx.expr<Awaited<ReturnType<FalSdkQueueClient["submit"]>>>({
                kind: "fal/queue_submit",
                endpointId: resolveEndpointId(endpointId),
                options: resolveOptions(options),
                config,
              });
            },

            status(endpointId: Expr<string> | string, options: FalQueueStatusOptions) {
              return ctx.expr<Awaited<ReturnType<FalSdkQueueClient["status"]>>>({
                kind: "fal/queue_status",
                endpointId: resolveEndpointId(endpointId),
                options: resolveOptions(options),
                config,
              });
            },

            result(endpointId: Expr<string> | string, options: FalQueueResultOptions) {
              return ctx.expr<Awaited<ReturnType<FalSdkQueueClient["result"]>>>({
                kind: "fal/queue_result",
                endpointId: resolveEndpointId(endpointId),
                options: resolveOptions(options),
                config,
              });
            },

            cancel(endpointId: Expr<string> | string, options: FalQueueCancelOptions) {
              return ctx.expr<void>({
                kind: "fal/queue_cancel",
                endpointId: resolveEndpointId(endpointId),
                options: resolveOptions(options),
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
// 4. Most implemented-method options are preserved:
//    Real:  fal.run(id, { input: {...}, method: "post", startTimeout: 30 })
//    Mvfm:   $.fal.run(id, { input: {...}, method: "post", startTimeout: 30 })
//    For run/subscribe/queue.submit/status/result/cancel, options are
//    carried through AST -> interpreter -> handler.
//
// 5. Runtime-only abort signals are excluded:
//    Real:  fal.run(id, { abortSignal: controller.signal })
//    Mvfm:   Not supported in AST. Signals are runtime handles and are
//    intentionally excluded from public option types.
//
// 6. Return types:
//    Real @fal-ai/client uses generic Result<OutputType<Id>> with
//    per-endpoint typed responses.
//    Mvfm uses SDK Result/queue status shapes, but does not currently
//    preserve endpoint-specific OutputType<Id> inference.
//
// 7. Subscribe callbacks:
//    Real:  fal.subscribe(id, { onQueueUpdate: (status) => ... })
//    Mvfm:   Not modelable. Callbacks are runtime concerns.
//
// DOESN'T WORK / NOT MODELED:
//
// 8. Streaming (fal.stream):
//    Real:  const stream = await fal.stream(id, { input })
//           for await (const chunk of stream) { ... }
//    Mvfm:   Can't model. SSE push-based, no finite AST shape.
//
// 9. Realtime (fal.realtime.connect):
//    Real:  const conn = fal.realtime.connect(app, { onResult, onError })
//           conn.send(input)
//    Mvfm:   Can't model. WebSocket bidirectional, stateful.
//
// 10. Storage upload:
//    Real:  const url = await fal.storage.upload(file)
//    Mvfm:   Deferred. Could be added as fal/storage_upload node kind.
//
// ============================================================
