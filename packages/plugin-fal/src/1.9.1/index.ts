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
import type { CExpr, Interpreter, KindSpec, Plugin } from "@mvfm/core";
import { isCExpr, makeCExpr } from "@mvfm/core";
import { wrapFalSdk } from "./client-fal-sdk";
import { createFalInterpreter, type FalClient } from "./interpreter";

// ---- liftArg: recursive plain-value → CExpr lifting --------

/**
 * Recursively lifts a plain value into a CExpr tree.
 * - CExpr values are returned as-is.
 * - Primitives are returned as-is (elaborate lifts them).
 * - Plain objects become `fal/record` CExprs with key-value child pairs.
 * - Arrays become `fal/array` CExprs.
 */
function liftArg(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return makeCExpr("fal/array", value.map(liftArg));
  }
  if (typeof value === "object") {
    const pairs: unknown[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      pairs.push(k, liftArg(v));
    }
    return makeCExpr("fal/record", pairs);
  }
  return value;
}

// liftArg erases generic type info at runtime (returns unknown).
// Cast helper restores the declared CExpr Args types for ExtractKinds.
const mk = makeCExpr as <O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: readonly unknown[],
) => CExpr<O, Kind, Args>;

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
export type FalRunOptions = RunOptionsShape | CExpr<RunOptionsShape>;
/** SDK-aligned subscribe options, excluding unsupported runtime-only fields. */
export type FalSubscribeOptions = SubscribeOptionsShape | CExpr<SubscribeOptionsShape>;
/** SDK-aligned queue.submit options, excluding unsupported runtime-only fields. */
export type FalSubmitOptions = SubmitOptionsShape | CExpr<SubmitOptionsShape>;
/** SDK-aligned queue.status options, excluding unsupported runtime-only fields. */
export type FalQueueStatusOptions = QueueStatusOptionsShape | CExpr<QueueStatusOptionsShape>;
/** SDK-aligned queue.result options, excluding unsupported runtime-only fields. */
export type FalQueueResultOptions = QueueResultOptionsShape | CExpr<QueueResultOptionsShape>;
/** SDK-aligned queue.cancel options, excluding unsupported runtime-only fields. */
export type FalQueueCancelOptions = QueueCancelOptionsShape | CExpr<QueueCancelOptionsShape>;

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

// ---- Default interpreter wiring ---------------------------

const dynamicImport = new Function("m", "return import(m)") as (
  moduleName: string,
) => Promise<Record<string, unknown>>;

function createDefaultInterpreter(config: FalConfig): Interpreter {
  let clientPromise: Promise<FalClient> | undefined;
  const getClient = async (): Promise<FalClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("@fal-ai/client").then((moduleValue) => {
        const falClient = moduleValue.fal as FalSdkClient;
        (falClient as unknown as { config: (o: { credentials: string }) => void }).config({
          credentials: config.credentials,
        });
        return wrapFalSdk(falClient);
      });
    }
    return clientPromise;
  };

  const lazyClient: FalClient = {
    async run(endpointId, options) {
      const client = await getClient();
      return client.run(endpointId, options);
    },
    async subscribe(endpointId, options) {
      const client = await getClient();
      return client.subscribe(endpointId, options);
    },
    async queueSubmit(endpointId, options) {
      const client = await getClient();
      return client.queueSubmit(endpointId, options);
    },
    async queueStatus(endpointId, options) {
      const client = await getClient();
      return client.queueStatus(endpointId, options);
    },
    async queueResult(endpointId, options) {
      const client = await getClient();
      return client.queueResult(endpointId, options);
    },
    async queueCancel(endpointId, options) {
      const client = await getClient();
      return client.queueCancel(endpointId, options);
    },
  };

  return createFalInterpreter(lazyClient);
}

// ---- Plugin factory ---------------------------------------

/**
 * Creates the fal plugin definition (unified Plugin type).
 *
 * @param config - A {@link FalConfig} with credentials.
 * @returns A unified Plugin that contributes `$.fal`.
 */
export function fal(config: FalConfig) {
  return {
    name: "fal" as const,
    ctors: {
      fal: {
        /** Run an endpoint synchronously. Mirrors `fal.run(endpointId, { input })`. */
        run<A, B>(
          endpointId: A,
          options?: B,
        ): CExpr<Awaited<ReturnType<FalSdkClient["run"]>>, "fal/run", [A, ...unknown[]]> {
          const children: unknown[] = [endpointId];
          if (options != null) children.push(liftArg(options));
          return mk("fal/run", children);
        },

        /** Subscribe to an endpoint (queue submit + poll + result). */
        subscribe<A, B>(
          endpointId: A,
          options?: B,
        ): CExpr<
          Awaited<ReturnType<FalSdkClient["subscribe"]>>,
          "fal/subscribe",
          [A, ...unknown[]]
        > {
          const children: unknown[] = [endpointId];
          if (options != null) children.push(liftArg(options));
          return mk("fal/subscribe", children);
        },

        queue: {
          /** Submit a request to the queue. */
          submit<A, B>(
            endpointId: A,
            options: B,
          ): CExpr<Awaited<ReturnType<FalSdkQueueClient["submit"]>>, "fal/queue_submit", [A, B]> {
            return mk("fal/queue_submit", [endpointId, liftArg(options)]);
          },

          /** Check the status of a queued request. */
          status<A, B>(
            endpointId: A,
            options: B,
          ): CExpr<Awaited<ReturnType<FalSdkQueueClient["status"]>>, "fal/queue_status", [A, B]> {
            return mk("fal/queue_status", [endpointId, liftArg(options)]);
          },

          /** Retrieve the result of a completed queued request. */
          result<A, B>(
            endpointId: A,
            options: B,
          ): CExpr<Awaited<ReturnType<FalSdkQueueClient["result"]>>, "fal/queue_result", [A, B]> {
            return mk("fal/queue_result", [endpointId, liftArg(options)]);
          },

          /** Cancel a queued request. */
          cancel<A, B>(endpointId: A, options: B): CExpr<void, "fal/queue_cancel", [A, B]> {
            return mk("fal/queue_cancel", [endpointId, liftArg(options)]);
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
      "fal/record": {
        inputs: [] as unknown[],
        output: {} as Record<string, unknown>,
      } as KindSpec<unknown[], Record<string, unknown>>,
      "fal/array": {
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
 * Alias for {@link fal}, kept for readability at call sites.
 */
export const falPlugin = fal;
