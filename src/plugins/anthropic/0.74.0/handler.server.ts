import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { AnthropicClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Anthropic effects
 * against a real Anthropic client.
 *
 * Handles `anthropic/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: AnthropicClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "anthropic/api_call") {
      const { method, path, params } = effect as {
        type: "anthropic/api_call";
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * an Anthropic client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link AnthropicClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: AnthropicClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
