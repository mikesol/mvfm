// ============================================================
// Stack-safe async fold with memoization and taint tracking
// ============================================================

/**
 * Base type for AST nodes in the interpreter. Carries a phantom type
 * parameter `T` tracking the runtime value type. No index signature —
 * handlers receive specific typed node interfaces, not untyped bags.
 */
export interface TypedNode<T = unknown> {
  readonly kind: string;
  readonly __T?: T;
}

/** Runtime binding for scoped lambda evaluation. */
export interface ScopedBinding {
  paramId: number;
  value: unknown;
}

/** Control effect: evaluate a child under temporary lexical bindings. */
export interface RecurseScopedEffect {
  type: "recurse_scoped";
  child: TypedNode;
  bindings: ScopedBinding[];
}

/** Values handlers can yield to the fold trampoline. */
export type FoldYield = TypedNode | RecurseScopedEffect;

/**
 * Evaluate a child node by yielding it to the trampoline.
 * Returns the typed result. This is the only user-facing cast —
 * TypeScript generators have a single `Next` type for all yields.
 */
export async function* eval_<T>(node: TypedNode<T>): AsyncGenerator<TypedNode, T, unknown> {
  return (yield node) as T;
}

/** Build a scoped recurse effect. */
export function recurseScoped(child: TypedNode, bindings: ScopedBinding[]): RecurseScopedEffect {
  return { type: "recurse_scoped", child, bindings };
}

/**
 * An interpreter is a plain record mapping node kind strings to
 * async generator handler functions. Composition is spread:
 * `{ ...num$, ...str$, ...console$ }`.
 */
export type Interpreter = Record<
  string,
  (node: any) => AsyncGenerator<FoldYield, unknown, unknown>
>;

/**
 * Handler type: an async generator for a specific typed node.
 * The return type is inferred from the node's phantom type.
 */
export type Handler<N extends TypedNode<any>> =
  N extends TypedNode<infer T> ? (node: N) => AsyncGenerator<FoldYield, T, unknown> : never;

/** Node kinds that are inherently volatile (never cached, always re-evaluated). */
export const VOLATILE_KINDS = new Set<string>(["core/lambda_param", "postgres/cursor_batch"]);

/** Externalized fold state for cache sharing across evaluations. */
export interface FoldState {
  cache: WeakMap<TypedNode, unknown>;
  tainted: WeakSet<TypedNode>;
}

/** Create a fresh FoldState. */
export function createFoldState(): FoldState {
  return { cache: new WeakMap(), tainted: new WeakSet() };
}

/**
 * Walk an AST to verify all node kinds have handlers.
 * Throws before evaluation if any are missing.
 */
export function checkCompleteness(interpreter: Interpreter, root: TypedNode): void {
  const visited = new WeakSet<TypedNode>();
  const missing = new Set<string>();
  const queue: TypedNode[] = [root];

  while (queue.length > 0) {
    const node = queue.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);

    if (!interpreter[node.kind]) missing.add(node.kind);

    for (const val of Object.values(node)) {
      if (val && typeof val === "object" && "kind" in val) {
        queue.push(val as TypedNode);
      }
      if (Array.isArray(val)) {
        for (const v of val) {
          if (v && typeof v === "object" && "kind" in v) {
            queue.push(v as TypedNode);
          }
        }
      }
    }
  }

  if (missing.size > 0) {
    throw new Error(`Missing interpreters for: ${[...missing].join(", ")}`);
  }
}

type Frame = {
  gen: AsyncGenerator<FoldYield, unknown, unknown>;
  node: TypedNode;
  childNodes: Set<TypedNode>;
  restoreScopeDepth: number | null;
};

/** Stack-safe async fold with memoization and taint tracking. */
export async function foldAST(
  interpreter: Interpreter,
  root: TypedNode,
  state?: FoldState,
): Promise<unknown> {
  const { cache, tainted } = state ?? createFoldState();
  const stack: Frame[] = [];
  const scopeStack: Array<Map<number, unknown>> = [];

  function isVolatile(node: TypedNode): boolean {
    return VOLATILE_KINDS.has(node.kind);
  }

  function isTainted(node: TypedNode): boolean {
    return tainted.has(node);
  }

  function resolveScopedParam(node: TypedNode): { found: true; value: unknown } | { found: false } {
    if (node.kind !== "core/lambda_param") return { found: false };
    const id = (node as { __id?: unknown }).__id;
    if (typeof id !== "number") return { found: false };
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(id)) {
        return { found: true, value: scopeStack[i].get(id) };
      }
    }
    return { found: false };
  }

  function push(node: TypedNode, restoreScopeDepth: number | null = null): void {
    const scoped = resolveScopedParam(node);
    if (scoped.found) {
      stack.push({
        // biome-ignore lint/correctness/useYield: leaf scoped param frame returns directly
        gen: (async function* () {
          return scoped.value;
        })(),
        node,
        childNodes: new Set(),
        restoreScopeDepth,
      });
      return;
    }

    const h = interpreter[node.kind];
    if (!h) throw new Error(`No interpreter for: ${node.kind}`);
    stack.push({ gen: h(node), node, childNodes: new Set(), restoreScopeDepth });
  }

  function restoreScope(depth: number | null): void {
    if (depth === null) return;
    scopeStack.length = depth;
  }

  function isRecurseScoped(effect: FoldYield): effect is RecurseScopedEffect {
    return (
      typeof effect === "object" &&
      effect !== null &&
      "type" in effect &&
      (effect as { type?: unknown }).type === "recurse_scoped"
    );
  }

  push(root);
  let input: unknown;
  let pendingError: unknown;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    let result: IteratorResult<FoldYield, unknown>;

    try {
      result =
        pendingError !== undefined
          ? await frame.gen.throw(pendingError)
          : await frame.gen.next(input);
      pendingError = undefined;
    } catch (e) {
      const doneFrame = stack.pop()!;
      restoreScope(doneFrame.restoreScopeDepth);
      if (stack.length === 0) throw e;
      pendingError = e;
      continue;
    }

    if (result.done) {
      const doneFrame = stack.pop()!;
      restoreScope(doneFrame.restoreScopeDepth);
      const value = result.value;

      const shouldTaint = isVolatile(frame.node) || [...frame.childNodes].some((c) => isTainted(c));

      if (shouldTaint) {
        tainted.add(frame.node);
        cache.delete(frame.node);
      } else {
        cache.set(frame.node, value);
      }

      if (stack.length > 0) {
        stack[stack.length - 1].childNodes.add(frame.node);
      }

      input = value;
      continue;
    }

    if (isRecurseScoped(result.value)) {
      const { child, bindings } = result.value;
      frame.childNodes.add(child);
      const restoreDepth = scopeStack.length;
      scopeStack.push(new Map(bindings.map((b) => [b.paramId, b.value])));

      if (!isTainted(child) && cache.has(child)) {
        input = cache.get(child);
        scopeStack.length = restoreDepth;
      } else {
        push(child, restoreDepth);
        input = undefined;
      }
      continue;
    }

    const child = result.value;
    frame.childNodes.add(child);

    const scoped = resolveScopedParam(child);
    if (scoped.found) {
      // Scoped params are volatile: never cache, always taint upstream.
      tainted.add(child);
      cache.delete(child);
      input = scoped.value;
    } else if (!isTainted(child) && cache.has(child)) {
      input = cache.get(child);
    } else {
      push(child);
      input = undefined;
    }
  }

  return input;
}

/**
 * A program with phantom type `K` tracking all node kinds used.
 * `typedFoldAST` infers `K` and requires a complete interpreter.
 */
export interface TypedProgram<K extends string> {
  root: TypedNode;
  readonly __kinds?: K;
}

/**
 * Complete interpreter type: must have a handler for every kind `K`.
 */
export type CompleteInterpreter<K extends string> = {
  [key in K]: (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
};

/**
 * Type-safe fold that enforces interpreter completeness at compile time.
 * Program goes first so `K` is inferred before the interpreter is checked.
 */
export async function typedFoldAST<K extends string>(
  program: TypedProgram<K>,
  interpreter: CompleteInterpreter<K>,
  state?: FoldState,
): Promise<unknown> {
  return foldAST(interpreter as Interpreter, program.root, state);
}
