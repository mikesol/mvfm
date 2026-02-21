/**
 * Fold — async trampoline evaluation over DAG adjacency maps.
 *
 * fold() drives async generator handlers via an explicit stack,
 * providing memoization, short-circuit evaluation, and stack safety.
 * defaults() merges interpreters from a plugin list with optional overrides.
 */

import type { RuntimeEntry, NExpr, OutOf } from "./expr";
import type { Handler, Interpreter } from "./plugin";

/** Frame in the fold trampoline stack. */
interface Frame {
  id: string;
  gen: AsyncGenerator<number | string, unknown, unknown>;
  _pendingValue?: unknown;
}

/** Minimal plugin definition for defaults(). */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

/** Fold an NExpr using an interpreter, inferring the output type. */
export async function fold<E extends NExpr<any, any, any, any>>(
  expr: E,
  interp: Interpreter,
): Promise<OutOf<E>>;
/** Fold a root ID + adjacency map using an interpreter. */
export async function fold<T>(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
): Promise<T>;
export async function fold(
  rootIdOrExpr: string | NExpr<any, any, any, any>,
  adjOrInterp: Record<string, RuntimeEntry> | Interpreter,
  maybeInterp?: Interpreter,
): Promise<unknown> {
  let rootId: string;
  let adj: Record<string, RuntimeEntry>;
  let interp: Interpreter;
  if (typeof rootIdOrExpr === "string") {
    rootId = rootIdOrExpr;
    adj = adjOrInterp as Record<string, RuntimeEntry>;
    interp = maybeInterp!;
  } else {
    rootId = rootIdOrExpr.__id;
    adj = rootIdOrExpr.__adj;
    interp = adjOrInterp as Interpreter;
  }
  const memo: Record<string, unknown> = {};
  const stack: Frame[] = [];

  function pushNode(id: string): void {
    if (id in memo) return;
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);
    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({ id, gen: handler(entry) });
  }

  pushNode(rootId);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.id in memo) {
      stack.pop();
      continue;
    }

    const iterResult = await frame.gen.next(frame._pendingValue);

    if (iterResult.done) {
      memo[frame.id] = iterResult.value;
      stack.pop();
      if (stack.length > 0) {
        stack[stack.length - 1]._pendingValue = iterResult.value;
      }
      continue;
    }

    const yieldedValue = iterResult.value;
    let childId: string;
    if (typeof yieldedValue === "string") {
      childId = yieldedValue;
    } else {
      const entry = adj[frame.id];
      childId = entry.children[yieldedValue];
      if (childId === undefined) {
        throw new Error(
          `fold: node "${frame.id}" (${entry.kind}) has no child at index ${yieldedValue}`,
        );
      }
    }

    if (childId in memo) {
      frame._pendingValue = memo[childId];
      continue;
    }

    pushNode(childId);
  }

  if (!(rootId in memo)) {
    throw new Error(`fold: root "${rootId}" was not evaluated`);
  }
  return memo[rootId];
}

/** Merge interpreters from a plugin list, with optional per-plugin overrides. */
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
      // no kinds → nothing to interpret
    } else {
      throw new Error(
        `Plugin "${plugin.name}" has no defaultInterpreter and no override`,
      );
    }
  }
  return composed;
}
