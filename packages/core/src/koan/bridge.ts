import type { NExpr, OutOf, RuntimeEntry } from "./expr";

/** Async-generator handler for one runtime node entry. */
export type Handler = (entry: RuntimeEntry) => AsyncGenerator<number | string, unknown, unknown>;

/** Interpreter map keyed by runtime node kind. */
export type Interpreter = Record<string, Handler>;

/** Minimal plugin shape required for defaults interpreter composition. */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

interface Frame {
  id: string;
  gen: AsyncGenerator<number | string, unknown, unknown>;
  started: boolean;
  pending?: unknown;
}

function resolveChildId(entry: RuntimeEntry, yielded: number | string): string {
  if (typeof yielded === "string") return yielded;
  const id = entry.children[yielded];
  if (id === undefined) {
    throw new Error(`fold: node "${entry.kind}" has no child at index ${yielded}`);
  }
  return id;
}

/** Fold an NExpr using an interpreter trampoline (stack-safe, memoized). */
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
  const stack: Frame[] = [];

  const pushNode = (id: string): void => {
    if (id in memo) return;
    const entry = adj[id];
    if (!entry) throw new Error(`fold: missing node "${id}"`);
    const handler = interp[entry.kind];
    if (!handler) throw new Error(`fold: no handler for "${entry.kind}"`);
    stack.push({ id, gen: handler(entry), started: false });
  };

  pushNode(rootId);

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (!frame) break;
    if (frame.id in memo) {
      stack.pop();
      continue;
    }

    const step = frame.started ? await frame.gen.next(frame.pending) : await frame.gen.next();
    frame.started = true;
    frame.pending = undefined;

    if (step.done) {
      memo[frame.id] = step.value;
      stack.pop();
      const parent = stack[stack.length - 1];
      if (parent) parent.pending = step.value;
      continue;
    }

    const current = adj[frame.id];
    if (!current) throw new Error(`fold: missing node "${frame.id}"`);
    const childId = resolveChildId(current, step.value);
    if (childId in memo) {
      frame.pending = memo[childId];
      continue;
    }
    pushNode(childId);
  }

  if (!(rootId in memo)) throw new Error(`fold: root "${rootId}" was not evaluated`);
  return memo[rootId];
}

/** Compose default interpreters from plugin defs with optional per-plugin overrides. */
export function defaults(
  plugins: readonly PluginDef[],
  overrides: Record<string, Interpreter> = {},
): Interpreter {
  const out: Interpreter = {};
  for (const plugin of plugins) {
    if (plugin.name in overrides) {
      Object.assign(out, overrides[plugin.name]);
      continue;
    }
    if (plugin.defaultInterpreter) {
      Object.assign(out, plugin.defaultInterpreter());
      continue;
    }
    if (plugin.nodeKinds.length === 0) continue;
    throw new Error(`Plugin "${plugin.name}" has no defaultInterpreter and no override`);
  }
  return out;
}
