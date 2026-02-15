import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { SlackClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Slack effects
 * against a real Slack client.
 *
 * Handles `slack/api_call` effects by delegating to
 * `client.apiCall(method, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link SlackClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: SlackClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "slack/api_call") {
      const { method, params } = effect as {
        type: "slack/api_call";
        method: string;
        params?: Record<string, unknown>;
      };
      const value = await client.apiCall(method, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Slack client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link SlackClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: SlackClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
