// ============================================================
// MVFM PLUGIN: fal (@fal-ai/client) — unified Plugin
// ============================================================
//
// Ported to the unified Plugin type with makeCExpr and
// index-based fold handlers. Config captured in interpreter
// closure, not stored on AST nodes.
//
// Implemented:
//   - run: direct synchronous endpoint execution
//   - subscribe: queue-based execution (submit + poll + result)
//   - queue.submit: submit request to queue
//   - queue.status: check queue request status
//   - queue.result: retrieve queue request result
//   - queue.cancel: cancel queued request
// ============================================================

import type { FalClient as FalSdkClient, QueueClient as FalSdkQueueClient } from "@fal-ai/client";
import type { CExpr, KindSpec, Liftable, Plugin } from "@mvfm/core";
import { makeCExpr } from "@mvfm/core";

// ---- Option type aliases ----------------------------------

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
export type FalRunOptions = Liftable<RunOptionsShape>;
/** SDK-aligned subscribe options, excluding unsupported runtime-only fields. */
export type FalSubscribeOptions = Liftable<SubscribeOptionsShape>;
/** SDK-aligned queue.submit options, excluding unsupported runtime-only fields. */
export type FalSubmitOptions = Liftable<SubmitOptionsShape>;
/** SDK-aligned queue.status options, excluding unsupported runtime-only fields. */
export type FalQueueStatusOptions = Liftable<QueueStatusOptionsShape>;
/** SDK-aligned queue.result options, excluding unsupported runtime-only fields. */
export type FalQueueResultOptions = Liftable<QueueResultOptionsShape>;
/** SDK-aligned queue.cancel options, excluding unsupported runtime-only fields. */
export type FalQueueCancelOptions = Liftable<QueueCancelOptionsShape>;

// ---- Plugin definition ------------------------------------

/**
 * The fal plugin definition (unified Plugin type).
 *
 * Contributes `$.fal` with run, subscribe, and queue methods.
 * Requires an interpreter provided via
 * `defaults(plugins, { fal: createFalInterpreter(client) })`.
 */
export const fal = {
  name: "fal" as const,
  ctors: {
    fal: {
      /** Run an endpoint synchronously. Mirrors `fal.run(endpointId, { input })`. */
      run(
        endpointId: string | CExpr<string>,
        ...options: [] | [Liftable<RunOptionsShape>]
      ): CExpr<Awaited<ReturnType<FalSdkClient["run"]>>, "fal/run"> {
        return makeCExpr("fal/run", [endpointId, ...options] as unknown[]) as any;
      },

      /** Subscribe to an endpoint (queue submit + poll + result). */
      subscribe(
        endpointId: string | CExpr<string>,
        ...options: [] | [Liftable<SubscribeOptionsShape>]
      ): CExpr<Awaited<ReturnType<FalSdkClient["subscribe"]>>, "fal/subscribe"> {
        return makeCExpr("fal/subscribe", [endpointId, ...options] as unknown[]) as any;
      },

      queue: {
        /** Submit a request to the queue. */
        submit(
          endpointId: string | CExpr<string>,
          options: Liftable<SubmitOptionsShape>,
        ): CExpr<Awaited<ReturnType<FalSdkQueueClient["submit"]>>, "fal/queue_submit"> {
          return makeCExpr("fal/queue_submit", [endpointId, options] as unknown[]) as any;
        },

        /** Check the status of a queued request. */
        status(
          endpointId: string | CExpr<string>,
          options: Liftable<QueueStatusOptionsShape>,
        ): CExpr<Awaited<ReturnType<FalSdkQueueClient["status"]>>, "fal/queue_status"> {
          return makeCExpr("fal/queue_status", [endpointId, options] as unknown[]) as any;
        },

        /** Retrieve the result of a completed queued request. */
        result(
          endpointId: string | CExpr<string>,
          options: Liftable<QueueResultOptionsShape>,
        ): CExpr<Awaited<ReturnType<FalSdkQueueClient["result"]>>, "fal/queue_result"> {
          return makeCExpr("fal/queue_result", [endpointId, options] as unknown[]) as any;
        },

        /** Cancel a queued request. */
        cancel(
          endpointId: string | CExpr<string>,
          options: Liftable<QueueCancelOptionsShape>,
        ): CExpr<void, "fal/queue_cancel"> {
          return makeCExpr("fal/queue_cancel", [endpointId, options] as unknown[]) as any;
        },
      },
    },
  },
  kinds: {
    "fal/run": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "fal/subscribe": {
      inputs: [undefined] as [unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown], unknown>,
    "fal/queue_submit": {
      inputs: [undefined, undefined] as [unknown, unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown, unknown], unknown>,
    "fal/queue_status": {
      inputs: [undefined, undefined] as [unknown, unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown, unknown], unknown>,
    "fal/queue_result": {
      inputs: [undefined, undefined] as [unknown, unknown],
      output: undefined as unknown,
    } as KindSpec<[unknown, unknown], unknown>,
    "fal/queue_cancel": {
      inputs: [undefined, undefined] as [unknown, unknown],
      output: undefined as unknown as undefined,
    } as KindSpec<[unknown, unknown], void>,
  },
  shapes: {
    "fal/run": [null, "*"] as [null, "*"],
    "fal/subscribe": [null, "*"] as [null, "*"],
    "fal/queue_submit": [null, "*"] as [null, "*"],
    "fal/queue_status": [null, "*"] as [null, "*"],
    "fal/queue_result": [null, "*"] as [null, "*"],
    "fal/queue_cancel": [null, "*"] as [null, "*"],
  },
  traits: {},
  lifts: {},
} satisfies Plugin;

/**
 * Alias for {@link fal}, kept for readability at call sites.
 */
export const falPlugin = fal;
