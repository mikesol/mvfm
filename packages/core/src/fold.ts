/**
 * Fold — async trampoline evaluation over DAG adjacency maps.
 *
 * fold() drives async generator handlers via an explicit stack,
 * providing memoization, short-circuit evaluation, and stack safety.
 *
 * Production extensions:
 * - VOLATILE_KINDS: nodes that skip memoization (e.g. st/get, lambda params)
 * - Taint propagation: ancestors of volatile nodes are also not cached
 * - Error propagation: gen.throw() for handler-level try/catch
 * - Scoped lambdas: RecurseScopedEffect for lexical binding evaluation
 * - Shared FoldState: cache sharing across independent fold calls (fibers)
 *
 * defaults() merges interpreters from a plugin list with optional overrides.
 */

import type { NExpr, OutOf, RuntimeEntry } from "./expr";
import type { FoldYield, Interpreter, RecurseScopedEffect } from "./plugin";

// ─── Volatile kinds ─────────────────────────────────────────────────

/** Node kinds that skip memoization and taint their ancestors. */
export const VOLATILE_KINDS = new Set<string>(["core/lambda_param"]);

// ─── FoldState: externalized cache for sharing across fold calls ────

/** Externalized fold state for cache sharing across evaluations (fibers). */
export interface FoldState {
  memo: Record<string, unknown>;
  tainted: Set<string>;
}

/** Create a fresh FoldState for sharing across fold calls. */
export function createFoldState(): FoldState {
  return { memo: {}, tainted: new Set() };
}

// ─── recurseScoped: helper to build scoped effects ──────────────────

/** Build a RecurseScopedEffect for yielding from a handler. */
export function recurseScoped(
  childId: string,
  bindings: Array<{ paramId: string; value: unknown }>,
): RecurseScopedEffect {
  return { type: "recurse_scoped", childId, bindings };
}

// ─── Frame ──────────────────────────────────────────────────────────

interface Frame {
  id: string;
  gen: AsyncGenerator<FoldYield, unknown, unknown>;
  _pendingValue?: unknown;
  childIds: Set<string>;
  restoreScopeDepth: number | null;
}

// ─── PluginDef for defaults() ───────────────────────────────────────

/** Minimal plugin definition for defaults(). */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

// ─── fold ───────────────────────────────────────────────────────────

/** Fold an NExpr using an interpreter, inferring the output type. */
export async function fold<E extends NExpr<any, any, any, any>>(
  expr: E,
  interp: Interpreter,
  state?: FoldState,
): Promise<OutOf<E>>;
/** Fold a root ID + adjacency map using an interpreter. */
export async function fold<T>(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
  state?: FoldState,
): Promise<T>;
export async function fold(
  rootIdOrExpr: string | NExpr<any, any, any, any>,
  adjOrInterp: Record<string, RuntimeEntry> | Interpreter,
  interpOrState?: Interpreter | FoldState,
  maybeState?: FoldState,
): Promise<unknown> {
  let rootId: string;
  let adj: Record<string, RuntimeEntry>;
  let interp: Interpreter;
  let externalState: FoldState | undefined;
  if (typeof rootIdOrExpr === "string") {
    rootId = rootIdOrExpr;
    adj = adjOrInterp as Record<string, RuntimeEntry>;
    interp = interpOrState as Interpreter;
    externalState = maybeState;
  } else {
    rootId = rootIdOrExpr.__id;
    adj = rootIdOrExpr.__adj;
    interp = adjOrInterp as Interpreter;
    externalState = interpOrState as FoldState | undefined;
  }

  const { memo, tainted } = externalState ?? createFoldState();
  const scopeStack: Array<Map<string, unknown>> = [];
  const stack: Frame[] = [];

  function resolveScopedParam(
    id: string,
    entry: RuntimeEntry,
  ): { found: true; value: unknown } | { found: false } {
    if (entry.kind !== "core/lambda_param") return { found: false };
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(id)) return { found: true, value: scopeStack[i].get(id) };
    }
    return { found: false };
  }

  function isRecurseScoped(v: FoldYield): v is RecurseScopedEffect {
    return typeof v === "object" && v !== null && "type" in v && v.type === "recurse_scoped";
  }

  function pushNode(id: string, restoreScopeDepth: number | null = null): void {
    if (id in memo && !tainted.has(id)) return;
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);

    const scoped = resolveScopedParam(id, entry);
    if (scoped.found) {
      const gen = (async function* () {
        return scoped.value;
      })();
      stack.push({ id, gen, childIds: new Set(), restoreScopeDepth });
      return;
    }

    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({ id, gen: handler(entry), childIds: new Set(), restoreScopeDepth });
  }

  pushNode(rootId);
  let pendingError: unknown;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.id in memo && !tainted.has(frame.id)) {
      stack.pop();
      if (frame.restoreScopeDepth !== null) scopeStack.length = frame.restoreScopeDepth;
      if (stack.length > 0) stack[stack.length - 1]._pendingValue = memo[frame.id];
      continue;
    }

    let iterResult: IteratorResult<FoldYield, unknown>;
    try {
      iterResult =
        pendingError !== undefined
          ? await frame.gen.throw(pendingError)
          : await frame.gen.next(frame._pendingValue);
      pendingError = undefined;
    } catch (e) {
      stack.pop();
      if (frame.restoreScopeDepth !== null) scopeStack.length = frame.restoreScopeDepth;
      if (stack.length === 0) throw e;
      pendingError = e;
      continue;
    }

    if (iterResult.done) {
      stack.pop();
      if (frame.restoreScopeDepth !== null) scopeStack.length = frame.restoreScopeDepth;
      const value = iterResult.value;

      const isVol = VOLATILE_KINDS.has(adj[frame.id]?.kind ?? "");
      const childTainted = [...frame.childIds].some((cid) => tainted.has(cid));
      if (isVol || childTainted) {
        tainted.add(frame.id);
      }
      memo[frame.id] = value;

      if (stack.length > 0) {
        stack[stack.length - 1].childIds.add(frame.id);
        stack[stack.length - 1]._pendingValue = value;
      }
      continue;
    }

    const yieldedValue = iterResult.value;

    // Handle RecurseScopedEffect
    if (isRecurseScoped(yieldedValue)) {
      const { childId, bindings } = yieldedValue;
      frame.childIds.add(childId);
      const restoreDepth = scopeStack.length;
      scopeStack.push(new Map(bindings.map((b) => [b.paramId, b.value])));
      if (childId in memo && !tainted.has(childId)) {
        frame._pendingValue = memo[childId];
        scopeStack.length = restoreDepth;
      } else {
        pushNode(childId, restoreDepth);
        frame._pendingValue = undefined;
      }
      continue;
    }

    // Resolve child ID from yield
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

    frame.childIds.add(childId);

    if (childId in memo && !tainted.has(childId)) {
      frame._pendingValue = memo[childId];
      continue;
    }

    pushNode(childId);
    frame._pendingValue = undefined;
  }

  if (!(rootId in memo)) throw new Error(`fold: root "${rootId}" was not evaluated`);
  return memo[rootId];
}

// ─── defaults ───────────────────────────────────────────────────────

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
      throw new Error(`Plugin "${plugin.name}" has no defaultInterpreter and no override`);
    }
  }
  return composed;
}
