import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { PinoClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes pino effects
 * against a real pino client.
 *
 * Handles `pino/log` effects by delegating to
 * `client.log(level, bindings, mergeObject, msg)`.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: PinoClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "pino/log") {
      const { level, bindings, mergeObject, msg } = effect as {
        type: "pino/log";
        level: string;
        bindings: Record<string, unknown>[];
        mergeObject?: Record<string, unknown>;
        msg?: string;
      };
      await client.log(level, bindings, mergeObject, msg);
      return { value: undefined, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a pino client using the provided interpreter fragments.
 *
 * @param client - The {@link PinoClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: PinoClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
