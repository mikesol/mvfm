import type { ASTNode, InterpreterFragment, StepHandler } from "@mvfm/core";
import { runAST } from "@mvfm/core";
import type { FalClient } from "./interpreter";

/**
 * Creates a server-side StepHandler that executes fal effects
 * against a real fal client.
 *
 * Handles `fal/api_call` and `fal/subscribe` effects by delegating
 * to the appropriate client method. Throws on unhandled effect types.
 *
 * @param client - The {@link FalClient} to execute against.
 * @returns A StepHandler for void state.
 */
export function serverHandler(client: FalClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "fal/api_call") {
      const { endpointId, method, options } = effect as {
        type: "fal/api_call";
        endpointId: string;
        method: string;
        options?: unknown;
      };
      let value: unknown;
      switch (method) {
        case "run":
          value = await client.run(endpointId, options as Parameters<FalClient["run"]>[1]);
          break;
        case "queue_submit":
          value = await client.queueSubmit(
            endpointId,
            options as Parameters<FalClient["queueSubmit"]>[1],
          );
          break;
        case "queue_status":
          value = await client.queueStatus(
            endpointId,
            options as Parameters<FalClient["queueStatus"]>[1],
          );
          break;
        case "queue_result":
          value = await client.queueResult(
            endpointId,
            options as Parameters<FalClient["queueResult"]>[1],
          );
          break;
        case "queue_cancel":
          value = await client.queueCancel(
            endpointId,
            options as Parameters<FalClient["queueCancel"]>[1],
          );
          break;
        default:
          throw new Error(`serverHandler: unknown fal method "${method}"`);
      }
      return { value, state };
    }

    if (effect.type === "fal/subscribe") {
      const { endpointId, options } = effect as {
        type: "fal/subscribe";
        endpointId: string;
        options?: unknown;
      };
      const value = await client.subscribe(
        endpointId,
        options as Parameters<FalClient["subscribe"]>[1],
      );
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
