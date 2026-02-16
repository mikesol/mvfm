import type { ASTNode, InterpreterFragment, StepHandler } from "@mvfm/core";
import { runAST } from "@mvfm/core";
import type { ConsoleMethodName } from "./index";
import type { ConsoleClient } from "./interpreter";

/**
 * Creates a server-side StepHandler for `console/*` effects.
 *
 * @param client - Console effect execution client.
 * @returns A StepHandler for void state.
 */
export function serverHandler(client: ConsoleClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type.startsWith("console/")) {
      const { method, args } = effect as {
        type: string;
        method: ConsoleMethodName;
        args: unknown[];
      };
      await client.call(method, args);
      return { value: undefined, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluator using the console server handler.
 *
 * @param client - Console effect execution client.
 * @param fragments - Interpreter fragments for evaluation.
 * @returns An async AST evaluator function.
 */
export function serverEvaluate(
  client: ConsoleClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
