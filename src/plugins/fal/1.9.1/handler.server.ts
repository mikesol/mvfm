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
