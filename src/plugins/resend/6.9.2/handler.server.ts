import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { ResendClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Resend effects
 * against a real Resend client.
 *
 * Handles `resend/api_call` effects by delegating to
 * `client.request(method, path, params)`. Throws on unhandled effect types.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: ResendClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "resend/api_call") {
      const { method, path, params } = effect as {
        type: "resend/api_call";
        method: string;
        path: string;
        params?: unknown;
      };
      const value = await client.request(method, path, params);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Resend client using the provided interpreter fragments.
 *
 * Convenience wrapper composing fragments + {@link serverHandler} via `runAST`.
 *
 * @param client - The {@link ResendClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: ResendClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
