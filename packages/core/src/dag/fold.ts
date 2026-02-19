/**
 * fold() — base trampoline evaluator for NExpr adjacency maps.
 *
 * Evaluates an NExpr DAG using async generator interpreters.
 * Each handler is an async generator that yields child indices
 * to request child values, then returns its own value.
 *
 * Features:
 * - Stack-safe: explicit stack, no recursion
 * - Memoizing: shared DAG nodes evaluate exactly once
 * - Short-circuit: handlers control which children are evaluated
 * - Volatile/taint: volatile nodes always re-evaluate, taint propagates
 */

import type { NExpr, RuntimeEntry } from "./00-expr";

// ─── Interpreter types ──────────────────────────────────────────────

/** A handler evaluates a single node kind via an async generator. */
export type Handler = (
  entry: RuntimeEntry,
) => AsyncGenerator<number, unknown, unknown>;

/** Maps node kind strings to their handlers. */
export type Interpreter = Record<string, Handler>;

// ─── PluginDef ──────────────────────────────────────────────────────

/** Definition of a plugin that can provide a default interpreter. */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

// ─── defaults() ─────────────────────────────────────────────────────

/**
 * Compose interpreters from plugin definitions and optional overrides.
 *
 * For each plugin, uses the override if provided, otherwise falls back
 * to the plugin's defaultInterpreter. Throws if neither is available
 * and the plugin declares node kinds.
 */
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const composed: Interpreter = {};
  for (const plugin of plugins) {
    if (plugin.name in overrides) {
      Object.assign(composed, overrides[plugin.name]);
    } else if (plugin.defaultInterpreter) {
      Object.assign(composed, plugin.defaultInterpreter());
    } else if (plugin.nodeKinds.length === 0) {
      // no kinds to interpret
    } else {
      throw new Error(
        `Plugin "${plugin.name}" has no defaultInterpreter and no override`,
      );
    }
  }
  return composed;
}

// ─── Volatile kinds ─────────────────────────────────────────────────

/** Node kinds that always re-evaluate (never memoized). */
export const VOLATILE_KINDS: Set<string> = new Set([
  "core/lambda_param",
  "st/get",
]);

// ─── FoldOptions ────────────────────────────────────────────────────

/** Options for fold(). */
export interface FoldOptions {
  /** Set of node kinds that should always re-evaluate. Defaults to VOLATILE_KINDS. */
  volatileKinds?: Set<string>;
}

// ─── Frame: one activation on the evaluation stack ──────────────────

interface Frame {
  id: string;
  gen: AsyncGenerator<number, unknown, unknown>;
  pendingValue: unknown;
  tainted: boolean;
}

// ─── fold() ─────────────────────────────────────────────────────────

/**
 * Evaluate an NExpr DAG using an async-generator interpreter.
 *
 * Each handler yields child indices to request their evaluated values,
 * then returns its own result. The trampoline drives the generators
 * using an explicit stack, making it stack-safe for arbitrarily deep
 * DAGs. Shared nodes are memoized and evaluated exactly once.
 *
 * Volatile nodes (kinds in volatileKinds) always re-evaluate.
 * Taint propagates transitively: any node depending on a volatile
 * or tainted child is itself tainted and will re-evaluate.
 */
export async function fold<O>(
  expr: NExpr<O, string, unknown, string>,
  interp: Interpreter,
  options?: FoldOptions,
): Promise<O> {
  const rootId = expr.__id;
  const adj = expr.__adj;
  const memo: Record<string, unknown> = {};
  const tainted: Set<string> = new Set();
  const volatile = options?.volatileKinds ?? VOLATILE_KINDS;
  const stack: Frame[] = [];

  function isVolatile(id: string): boolean {
    const entry = adj[id];
    return entry !== undefined && volatile.has(entry.kind);
  }

  function pushNode(id: string): void {
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);
    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({
      id,
      gen: handler(entry),
      pendingValue: undefined,
      tainted: false,
    });
  }

  pushNode(rootId);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    // If node is already memoized AND not volatile/tainted, skip
    if (frame.id in memo && !isVolatile(frame.id) && !tainted.has(frame.id)) {
      stack.pop();
      continue;
    }

    const iterResult: IteratorResult<number, unknown> = await frame.gen.next(
      frame.pendingValue,
    );

    if (iterResult.done) {
      memo[frame.id] = iterResult.value;
      // Track taint: volatile nodes and nodes depending on them
      if (frame.tainted || isVolatile(frame.id)) {
        tainted.add(frame.id);
      }
      stack.pop();
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.pendingValue = iterResult.value;
        // Propagate taint to parent
        if (tainted.has(frame.id)) {
          parent.tainted = true;
        }
      }
      continue;
    }

    const childIndex = iterResult.value;
    const entry = adj[frame.id];
    const childId = entry.children[childIndex];
    if (childId === undefined) {
      throw new Error(
        `fold: node "${frame.id}" (${entry.kind}) has no child at index ${childIndex}`,
      );
    }

    // If child is volatile or tainted, always re-evaluate
    if (isVolatile(childId) || tainted.has(childId)) {
      delete memo[childId];
      pushNode(childId);
      continue;
    }

    if (childId in memo) {
      frame.pendingValue = memo[childId];
      continue;
    }

    pushNode(childId);
  }

  if (!(rootId in memo)) {
    throw new Error(`fold: root "${rootId}" was not evaluated`);
  }
  return memo[rootId] as O;
}
