import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { OpenAIClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes OpenAI effects
 * against a real OpenAI client.
 *
 * Handles `openai/api_call` effects by delegating to
 * `client.request(method, path, body)`. Throws on unhandled effect types.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: OpenAIClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "openai/api_call") {
      const { method, path, body } = effect as {
        type: "openai/api_call";
        method: string;
        path: string;
        body?: Record<string, unknown>;
      };
      const value = await client.request(method, path, body);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * an OpenAI client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link OpenAIClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: OpenAIClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
