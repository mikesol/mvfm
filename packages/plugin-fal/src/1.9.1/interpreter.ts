import type {
  FalClient as FalSdkClient,
  QueueClient as FalSdkQueueClient,
  QueueStatus,
  Result,
} from "@fal-ai/client";
import type { ASTNode, InterpreterFragment, StepEffect } from "@mvfm/core";

/**
 * Fal client interface consumed by the fal handler.
 *
 * Abstracts over the actual `\@fal-ai/client` so handlers can be
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
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "run",
          ...(options !== undefined ? { options } : {}),
        };
      }

      case "fal/subscribe": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/subscribe",
          endpointId,
          ...(options !== undefined ? { options } : {}),
        };
      }

      case "fal/queue_submit": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_submit",
          ...(options !== undefined ? { options } : {}),
        };
      }

      case "fal/queue_status": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_status",
          ...(options !== undefined ? { options } : {}),
        };
      }

      case "fal/queue_result": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_result",
          ...(options !== undefined ? { options } : {}),
        };
      }

      case "fal/queue_cancel": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const options =
          node.options != null
            ? yield { type: "recurse", child: node.options as ASTNode }
            : undefined;
        return yield {
          type: "fal/api_call",
          endpointId,
          method: "queue_cancel",
          ...(options !== undefined ? { options } : {}),
        };
      }

      default:
        throw new Error(`Fal interpreter: unknown node kind "${node.kind}"`);
    }
  },
};
