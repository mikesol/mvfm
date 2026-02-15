import type { ASTNode, InterpreterFragment, StepEffect } from "../../../core";

/**
 * Fal client interface consumed by the fal handler.
 *
 * Abstracts over the actual `\@fal-ai/client` so handlers can be
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
          node.input != null ? yield { type: "recurse", child: node.input as ASTNode } : undefined;
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
          node.input != null ? yield { type: "recurse", child: node.input as ASTNode } : undefined;
        return yield {
          type: "fal/subscribe",
          endpointId,
          ...(input !== undefined ? { input } : {}),
        };
      }

      case "fal/queue_submit": {
        const endpointId = yield { type: "recurse", child: node.endpointId as ASTNode };
        const input =
          node.input != null ? yield { type: "recurse", child: node.input as ASTNode } : undefined;
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
