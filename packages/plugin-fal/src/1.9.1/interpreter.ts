import type {
  FalClient as FalSdkClient,
  QueueClient as FalSdkQueueClient,
  QueueStatus,
  Result,
} from "@fal-ai/client";
import type { Interpreter, TypedNode } from "@mvfm/core";
import { eval_ } from "@mvfm/core";

/**
 * Fal client interface consumed by the fal handler.
 *
 * Abstracts over the actual `@fal-ai/client` so handlers can be
 * tested with mock clients.
 */
export interface FalClient {
  /** Execute an endpoint synchronously. */
  run(endpointId: string, options?: Parameters<FalSdkClient["run"]>[1]): Promise<Result<unknown>>;
  /** Subscribe to an endpoint (queue submit + poll + result). */
  subscribe(
    endpointId: string,
    options?: Parameters<FalSdkClient["subscribe"]>[1],
  ): Promise<Result<unknown>>;
  /** Submit a request to the queue. */
  queueSubmit(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["submit"]>[1],
  ): Promise<unknown>;
  /** Check the status of a queued request. */
  queueStatus(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["status"]>[1],
  ): Promise<QueueStatus>;
  /** Retrieve the result of a completed queued request. */
  queueResult(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["result"]>[1],
  ): Promise<unknown>;
  /** Cancel a queued request. */
  queueCancel(
    endpointId: string,
    options: Parameters<FalSdkQueueClient["cancel"]>[1],
  ): Promise<void>;
}

interface FalNode extends TypedNode<unknown> {
  kind: string;
  endpointId: TypedNode<string>;
  options?: TypedNode;
}

/**
 * Creates an interpreter for `fal/*` node kinds.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns An Interpreter handling all fal node kinds.
 */
export function createFalInterpreter(client: FalClient): Interpreter {
  return {
    "fal/run": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.run(endpointId, options as any);
    },

    "fal/subscribe": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.subscribe(endpointId, options as any);
    },

    "fal/queue_submit": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueSubmit(endpointId, options as any);
    },

    "fal/queue_status": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueStatus(endpointId, options as any);
    },

    "fal/queue_result": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      return await client.queueResult(endpointId, options as any);
    },

    "fal/queue_cancel": async function* (node: FalNode) {
      const endpointId = yield* eval_(node.endpointId);
      const options = node.options != null ? yield* eval_(node.options) : undefined;
      await client.queueCancel(endpointId, options as any);
      return undefined;
    },
  };
}
