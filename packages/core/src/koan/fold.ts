import type { NExpr, OutOf, RuntimeEntry } from "./expr";
import { type Interpreter, type ScopedEffect, VOLATILE_KINDS } from "./fold-types";

interface Frame {
  id: string;
  gen: AsyncGenerator<number | string | ScopedEffect, unknown, unknown>;
  started: boolean;
  pending?: unknown;
  pendingError?: unknown;
  tainted: boolean;
  restoreScopeDepth: number | null;
}

function isScopedEffect(value: number | string | ScopedEffect): value is ScopedEffect {
  return typeof value === "object" && value !== null && value.type === "recurse_scoped";
}

function resolveChildId(entry: RuntimeEntry, yielded: number | string): string {
  if (typeof yielded === "string") return yielded;
  const id = entry.children[yielded];
  if (id === undefined) {
    throw new Error(`fold: node "${entry.kind}" has no child at index ${yielded}`);
  }
  return id;
}

function resolveScopedParam(
  id: string,
  scopeStack: Array<Map<string, unknown>>,
): { found: true; value: unknown } | { found: false } {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    if (scopeStack[i].has(id)) {
      return { found: true, value: scopeStack[i].get(id) };
    }
  }
  return { found: false };
}

async function* immediate(
  value: unknown,
): AsyncGenerator<number | string | ScopedEffect, unknown, unknown> {
  yield* [];
  return value;
}

/** Fold an NExpr using an interpreter trampoline (stack-safe, memoized, taint-aware). */
export async function fold<E extends NExpr<any, any, any, any>>(
  expr: E,
  interp: Interpreter,
): Promise<OutOf<E>>;
/** Fold from explicit root + adjacency using an interpreter trampoline. */
export async function fold<T>(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
): Promise<T>;
export async function fold(
  rootOrExpr: string | NExpr<any, any, any, any>,
  adjOrInterp: Record<string, RuntimeEntry> | Interpreter,
  maybeInterp?: Interpreter,
): Promise<unknown> {
  const rootId = typeof rootOrExpr === "string" ? rootOrExpr : rootOrExpr.__id;
  const adj = (typeof rootOrExpr === "string" ? adjOrInterp : rootOrExpr.__adj) as Record<
    string,
    RuntimeEntry
  >;
  const interp = (typeof rootOrExpr === "string" ? maybeInterp : adjOrInterp) as Interpreter;

  const memo: Record<string, unknown> = {};
  const tainted = new Set<string>();
  const scopeStack: Array<Map<string, unknown>> = [];
  const stack: Frame[] = [];

  const restoreScope = (depth: number | null): void => {
    if (depth === null) return;
    scopeStack.length = depth;
  };

  const pushNode = (id: string, restoreScopeDepth: number | null = null): void => {
    if (id in memo) return;
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);

    if (entry.kind === "core/lambda_param") {
      const scoped = resolveScopedParam(id, scopeStack);
      if (scoped.found) {
        stack.push({
          id,
          gen: immediate(scoped.value),
          started: false,
          tainted: true,
          restoreScopeDepth,
        });
        return;
      }
    }

    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({
      id,
      gen: handler(entry),
      started: false,
      tainted: VOLATILE_KINDS.has(entry.kind),
      restoreScopeDepth,
    });
  };

  let rootValue: unknown;
  let hasRootValue = false;

  pushNode(rootId);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (!frame) break;

    if (frame.id in memo) {
      const value = memo[frame.id];
      stack.pop();
      restoreScope(frame.restoreScopeDepth);
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.pending = value;
        parent.pendingError = undefined;
      }
      continue;
    }

    let step: IteratorResult<number | string | ScopedEffect, unknown>;
    try {
      if (!frame.started) {
        step = await frame.gen.next();
        frame.started = true;
      } else if (frame.pendingError !== undefined) {
        const error = frame.pendingError;
        frame.pendingError = undefined;
        step = await frame.gen.throw(error);
      } else {
        const value = frame.pending;
        frame.pending = undefined;
        step = await frame.gen.next(value);
      }
    } catch (error) {
      stack.pop();
      restoreScope(frame.restoreScopeDepth);
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.pendingError = error;
      } else {
        throw error;
      }
      continue;
    }

    if (step.done) {
      if (frame.tainted) {
        tainted.add(frame.id);
      } else {
        memo[frame.id] = step.value;
      }

      stack.pop();
      restoreScope(frame.restoreScopeDepth);

      if (frame.id === rootId) {
        rootValue = step.value;
        hasRootValue = true;
      }

      const parent = stack[stack.length - 1];
      if (parent) {
        parent.pending = step.value;
        parent.pendingError = undefined;
        if (tainted.has(frame.id)) parent.tainted = true;
      }
      continue;
    }

    const current = adj[frame.id];
    if (!current) throw new Error(`fold: missing node "${frame.id}"`);

    if (isScopedEffect(step.value)) {
      const restoreDepth = scopeStack.length;
      scopeStack.push(new Map(step.value.bindings.map((b) => [b.paramId, b.value])));
      const childId = resolveChildId(current, step.value.child);
      if (childId in memo) {
        frame.pending = memo[childId];
        scopeStack.length = restoreDepth;
        continue;
      }
      pushNode(childId, restoreDepth);
      continue;
    }

    const childId = resolveChildId(current, step.value);
    if (childId in memo) {
      frame.pending = memo[childId];
      continue;
    }
    pushNode(childId);
  }

  if (hasRootValue) return rootValue;
  if (rootId in memo) return memo[rootId];
  throw new Error(`fold: root "${rootId}" was not evaluated`);
}
