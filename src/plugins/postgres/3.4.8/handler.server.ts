import type {
  ASTNode,
  InterpreterFragment,
  LegacyInterpreterFragment,
  StepEffect,
  StepHandler,
} from "../../../core";
import type { PostgresClient } from "./interpreter";
import { findCursorBatch } from "./interpreter";

function isVolatileDefault(node: ASTNode): boolean {
  return node.kind === "core/lambda_param" || node.kind === "postgres/cursor_batch";
}

function isASTLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    typeof (value as any).kind === "string"
  );
}

function hasAnyTaintedChild(node: ASTNode, taintSet: WeakSet<ASTNode>): boolean {
  for (const value of Object.values(node)) {
    if (value !== null && typeof value === "object") {
      if (isASTLike(value) && taintSet.has(value as ASTNode)) return true;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isASTLike(item) && taintSet.has(item as ASTNode)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Internal: build an evaluate function that runs generators against
 * fragments and delegates non-recurse effects to a postgres-aware handler.
 *
 * Shares the given cache/taint sets so that cursor body evaluations
 * reuse cached results from the outer evaluation.
 */
function buildEvaluate(
  fragments: InterpreterFragment[],
  handleEffect: (effect: StepEffect, currentNode: ASTNode) => Promise<unknown>,
  cache: WeakMap<ASTNode, unknown>,
  taintedSet: WeakSet<ASTNode>,
): (node: ASTNode) => Promise<unknown> {
  function findFragment(node: ASTNode): InterpreterFragment {
    const f = fragments.find((fr) => fr.canHandle(node));
    if (!f) throw new Error(`No interpreter for node kind: ${node.kind}`);
    return f;
  }

  function isNodeVolatile(node: ASTNode): boolean {
    if (isVolatileDefault(node)) return true;
    for (const f of fragments) {
      if (f.isVolatile && f.canHandle(node) && f.isVolatile(node)) return true;
    }
    return false;
  }

  async function evaluate(node: ASTNode): Promise<unknown> {
    if (!taintedSet.has(node) && cache.has(node)) {
      return cache.get(node);
    }

    const fragment = findFragment(node);
    const gen = fragment.visit(node);
    let input: unknown;
    let isError = false;

    while (true) {
      const result = isError ? gen.throw(input) : gen.next(input);
      isError = false;

      if (result.done) {
        const value = result.value;
        if (!isNodeVolatile(node) && !hasAnyTaintedChild(node, taintedSet)) {
          cache.set(node, value);
        } else {
          taintedSet.add(node);
          cache.delete(node);
        }
        return value;
      }

      const effect = result.value as StepEffect;

      if (effect.type === "recurse") {
        const child = (effect as { type: "recurse"; child: ASTNode }).child;
        try {
          input = await evaluate(child);
        } catch (e) {
          input = e;
          isError = true;
        }
      } else if (effect.type === "__legacy") {
        const legacyEffect = effect as {
          type: "__legacy";
          fragment: LegacyInterpreterFragment;
          node: ASTNode;
        };
        try {
          input = await legacyEffect.fragment.visit(legacyEffect.node, evaluate);
        } catch (e) {
          input = e;
          isError = true;
        }
      } else {
        input = await handleEffect(effect, node);
      }
    }
  }

  return evaluate;
}

/**
 * Creates a server-side effect handler function for postgres effects.
 *
 * Unlike {@link serverHandler}, this does not return a `StepHandler` --
 * instead it returns a direct `handleEffect` function that can be used
 * internally by `buildEvaluate`. The `serverEvaluate` function composes
 * these together.
 */
function buildEffectHandler(
  client: PostgresClient,
  fragments: InterpreterFragment[],
  evaluate: (node: ASTNode) => Promise<unknown>,
): (effect: StepEffect, currentNode: ASTNode) => Promise<unknown> {
  return async (effect: StepEffect, _currentNode: ASTNode): Promise<unknown> => {
    switch (effect.type) {
      case "query": {
        const { sql, params } = effect as { type: "query"; sql: string; params: unknown[] };
        return client.query(sql, params);
      }

      case "begin": {
        const { mode, body, queries } = effect as {
          type: "begin";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };

        return client.begin(async (tx) => {
          // Transactions get a fresh evaluator with a new cache and new client
          const txEval = serverEvaluateInternal(tx, fragments);
          if (mode === "pipeline") {
            const results: unknown[] = [];
            for (const q of queries!) {
              results.push(await txEval(q));
            }
            return results;
          }
          return await txEval(body!);
        });
      }

      case "savepoint": {
        const { mode, body, queries } = effect as {
          type: "savepoint";
          mode: string;
          body?: ASTNode;
          queries?: ASTNode[];
        };

        return client.savepoint(async (tx) => {
          const txEval = serverEvaluateInternal(tx, fragments);
          if (mode === "pipeline") {
            const results: unknown[] = [];
            for (const q of queries!) {
              results.push(await txEval(q));
            }
            return results;
          }
          return await txEval(body!);
        });
      }

      case "cursor": {
        const { sql, params, batchSize, body } = effect as {
          type: "cursor";
          sql: string;
          params: unknown[];
          batchSize: number;
          body: ASTNode;
        };

        const batchNode = findCursorBatch(body);

        await client.cursor(sql, params, batchSize, async (rows) => {
          if (batchNode) {
            batchNode.__batchData = rows;
          }
          // Cursor body uses the SHARED evaluate function so that cached
          // results (e.g. settings queries) are reused across iterations
          await evaluate(body);
          return undefined;
        });

        return undefined;
      }

      default:
        throw new Error(`serverHandler: unhandled effect type "${effect.type}"`);
    }
  };
}

/**
 * Internal: create an evaluate function for a given client and fragments,
 * with its own cache. Used for both top-level evaluation and transaction scopes.
 */
function serverEvaluateInternal(
  client: PostgresClient,
  fragments: InterpreterFragment[],
): (node: ASTNode) => Promise<unknown> {
  const cache = new WeakMap<ASTNode, unknown>();
  const taintedSet = new WeakSet<ASTNode>();

  // Use a two-phase setup: first create evaluate with a placeholder handler,
  // then create the real handler that captures evaluate.
  let effectHandler: ((effect: StepEffect, node: ASTNode) => Promise<unknown>) | null = null;

  const evaluate = buildEvaluate(
    fragments,
    (effect, node) => effectHandler!(effect, node),
    cache,
    taintedSet,
  );

  effectHandler = buildEffectHandler(client, fragments, evaluate);

  return evaluate;
}

/**
 * Creates a server-side {@link StepHandler} that executes postgres effects
 * against a real database client.
 *
 * Handles the following effect types:
 * - `query` -- executes a parameterized SQL query
 * - `begin` -- opens a transaction, evaluates body/queries within it
 * - `savepoint` -- opens a savepoint, evaluates body/queries within it
 * - `cursor` -- streams a query in batches, evaluating the body for each batch
 *
 * For optimal caching behavior (sharing cache across cursor iterations),
 * prefer {@link serverEvaluate} which creates a unified evaluation function.
 * Use `serverHandler` when you need a `StepHandler` for use with `runAST`.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns A {@link StepHandler} for void state.
 */
export function serverHandler(
  client: PostgresClient,
  fragments: InterpreterFragment[],
): StepHandler<void> {
  const evaluate = serverEvaluateInternal(client, fragments);
  const effectHandler = buildEffectHandler(client, fragments, evaluate);

  const handlerFn: StepHandler<void> = async (effect, _context, state) => {
    const value = await effectHandler(effect, { kind: "unknown" });
    return { value, state };
  };

  return handlerFn;
}

/**
 * Creates a unified evaluation function that evaluates an AST against
 * a postgres client, with full caching across cursor iterations.
 *
 * This is the recommended way to evaluate programs with postgres effects
 * on the server. It creates a single shared cache for the entire evaluation,
 * ensuring that queries referenced both inside and outside cursor bodies
 * are only executed once.
 *
 * @param client - The {@link PostgresClient} to execute against.
 * @param fragments - Generator interpreter fragments for evaluating sub-expressions.
 * @returns An async function that evaluates an AST node to its result.
 */
export function serverEvaluate(
  client: PostgresClient,
  fragments: InterpreterFragment[],
): (root: ASTNode) => Promise<unknown> {
  return serverEvaluateInternal(client, fragments);
}
