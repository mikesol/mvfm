import type { ASTNode, InterpreterFragment, StepHandler } from "../../../core";
import { runAST } from "../../../core";
import type { RedisClient } from "./interpreter";

/**
 * Creates a server-side {@link StepHandler} that executes Redis effects
 * against a real Redis client.
 *
 * Handles `redis/command` effects by delegating to
 * `client.command(command, ...args)`. Throws on unhandled effect types.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(client: RedisClient): StepHandler<void> {
  return async (effect, _context, state) => {
    if (effect.type === "redis/command") {
      const { command, args } = effect as {
        type: "redis/command";
        command: string;
        args: unknown[];
      };
      const value = await client.command(command, ...args);
      return { value, state };
    }
    throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
  };
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a Redis client using the provided interpreter fragments.
 *
 * @param client - The {@link RedisClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: RedisClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return async (root: ASTNode): Promise<unknown> => {
    const { value } = await runAST(root, fragments, serverHandler(client), undefined);
    return value;
  };
}
