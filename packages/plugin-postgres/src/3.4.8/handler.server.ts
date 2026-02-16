import type { FoldState, Interpreter, TypedNode } from "@mvfm/core";
import { createFoldState, eval_, foldAST } from "@mvfm/core";
import {
  buildSQL,
  createPostgresInterpreter,
  type PostgresBeginNode,
  type PostgresClient,
  type PostgresCursorNode,
  type PostgresSavepointNode,
} from "./interpreter";

/**
 * Creates a full server-side interpreter for `postgres/*` node kinds,
 * including transaction and cursor support.
 *
 * Unlike `createPostgresInterpreter`, this handles `begin`, `savepoint`,
 * and `cursor` nodes by spawning new `foldAST` evaluations with fresh
 * or shared state as appropriate.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param baseInterpreter - Base interpreter for all non-postgres node kinds.
 * @returns An Interpreter for postgres node kinds.
 */
export function createPostgresServerInterpreter(
  client: PostgresClient,
  baseInterpreter: Interpreter,
): Interpreter {
  const base = createPostgresInterpreter(client);

  function makeEvaluator(
    txClient: PostgresClient,
    state?: FoldState,
  ): (node: TypedNode) => Promise<unknown> {
    const txInterp = {
      ...baseInterpreter,
      ...createPostgresServerInterpreter(txClient, baseInterpreter),
    };
    return (node: TypedNode) => foldAST(txInterp, node, state);
  }

  return {
    ...base,

    "postgres/begin": async function* (node: PostgresBeginNode) {
      return await client.begin(async (tx) => {
        const evaluate = makeEvaluator(tx);
        if (node.mode === "pipeline") {
          const results: unknown[] = [];
          for (const q of node.queries!) {
            results.push(await evaluate(q));
          }
          return results;
        }
        return await evaluate(node.body!);
      });
    },

    "postgres/savepoint": async function* (node: PostgresSavepointNode) {
      return await client.savepoint(async (tx) => {
        const evaluate = makeEvaluator(tx);
        if (node.mode === "pipeline") {
          const results: unknown[] = [];
          for (const q of node.queries!) {
            results.push(await evaluate(q));
          }
          return results;
        }
        return await evaluate(node.body!);
      });
    },

    "postgres/cursor": async function* (node: PostgresCursorNode) {
      const { sql, params } = yield* buildSQL(node.query);
      const batchSize = yield* eval_<number>(node.batchSize);

      const batchCell: { current: unknown[] } = { current: [] };
      const cursorState = createFoldState();

      const cursorInterp = {
        ...baseInterpreter,
        ...createPostgresServerInterpreter(client, baseInterpreter),
        // biome-ignore lint/correctness/useYield: returns closure data without needing child evaluation
        "postgres/cursor_batch": async function* () {
          return batchCell.current;
        },
      };
      const cursorEvaluate = (n: TypedNode) => foldAST(cursorInterp, n, cursorState);

      await client.cursor(sql, params, batchSize, async (rows) => {
        batchCell.current = rows;
        await cursorEvaluate(node.body);
        return undefined;
      });

      return undefined;
    },
  };
}

/**
 * Creates a server-side interpreter for `postgres/*` node kinds.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An Interpreter for postgres node kinds.
 */
export function serverInterpreter(
  client: PostgresClient,
  baseInterpreter: Interpreter,
): Interpreter {
  return createPostgresServerInterpreter(client, baseInterpreter);
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a postgres client, with full caching across cursor iterations.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param baseInterpreter - Base interpreter for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: PostgresClient,
  baseInterpreter: Interpreter,
): (root: TypedNode) => Promise<unknown> {
  const interp = {
    ...baseInterpreter,
    ...createPostgresServerInterpreter(client, baseInterpreter),
  };
  return (root: TypedNode) => foldAST(interp, root);
}
