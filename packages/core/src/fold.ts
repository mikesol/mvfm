// ============================================================
// Stack-safe async fold with memoization and taint tracking
// ============================================================

import type { Program } from "./types";

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

/**
 * Global registry mapping node kind strings to their typed node interfaces.
 * Plugins extend this via declaration merging (module augmentation).
 *
 * @example
 * ```ts
 * declare module "@mvfm/core" {
 *   interface NodeTypeMap {
 *     "myplugin/op": MyOpNode;
 *   }
 * }
 * ```
 */
export interface NodeTypeMap {}

/** Detect the `any` type. Returns `true` for `any`, `false` otherwise. */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/** Look up the node type for a kind from the registry, falling back to TypedNode. */
type NodeForKind<K extends string> = K extends keyof NodeTypeMap ? NodeTypeMap[K] : TypedNode;

/** Extract the phantom return type from a TypedNode. */
type ReturnOfNode<N extends TypedNode<any>> = N extends TypedNode<infer T> ? T : unknown;

/** The exact handler signature required for a given kind. */
type ExpectedHandler<K extends string> = (
  node: NodeForKind<K>,
) => AsyncGenerator<FoldYield, ReturnOfNode<NodeForKind<K>>, unknown>;

/** Extract the node parameter type from a handler function. */
type ExtractNodeParam<F> = F extends (node: infer N, ...args: any[]) => any ? N : unknown;

/**
 * Reject handlers with `any`-typed node parameters for registered kinds.
 * Unregistered kinds (not in NodeTypeMap) allow `any` as a migration escape hatch.
 */
type RejectAnyParam<K extends string, H> =
  IsAny<ExtractNodeParam<H>> extends true ? (K extends keyof NodeTypeMap ? never : H) : H;

/** Required handler shape for a set of kinds. */
type RequiredShape<K extends string> = {
  [P in K]: ExpectedHandler<P>;
};

/**
 * Create a typed interpreter with compile-time enforcement of handler signatures.
 *
 * Uses a curried form because TypeScript cannot partially infer generics —
 * `K` (the kinds) is specified explicitly, while `T` (handler types) is inferred.
 *
 * For registered kinds (in {@link NodeTypeMap}), this enforces:
 * - Correct node type on the handler parameter (not `any`, not wrong type)
 * - Correct return type matching the node's phantom `T`
 * - Completeness (every kind in `K` must have a handler)
 *
 * @example
 * ```ts
 * const interp = typedInterpreter<"redis/get" | "redis/set">()({
 *   "redis/get": async function* (node: RedisGetNode) { ... },
 *   "redis/set": async function* (node: RedisSetNode) { ... },
 * });
 * ```
 */
export function typedInterpreter<K extends string>() {
  return <T extends RequiredShape<K>>(
    handlers: T & {
      [P in K]: P extends keyof T ? RejectAnyParam<P, T[P]> : ExpectedHandler<P>;
    },
  ): T => handlers;
}

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

type Frame = {
  gen: AsyncGenerator<FoldYield, unknown, unknown>;
  node: TypedNode;
  childNodes: Set<TypedNode>;
  restoreScopeDepth: number | null;
};

/** Stack-safe async fold with memoization and taint tracking. */
export async function foldAST(
  interpreter: Interpreter,
  program: Program,
  state?: FoldState,
): Promise<unknown>;
export async function foldAST(
  interpreter: Interpreter,
  root: TypedNode,
  state?: FoldState,
): Promise<unknown>;
export async function foldAST(
  interpreter: Interpreter,
  rootOrProgram: TypedNode | Program,
  state?: FoldState,
): Promise<unknown> {
  const root =
    "ast" in rootOrProgram && "hash" in rootOrProgram
      ? (rootOrProgram as Program).ast.result
      : (rootOrProgram as TypedNode);
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
 * Registered kinds (in {@link NodeTypeMap}) get full type checking via
 * {@link Handler}. Unregistered kinds fall back to `(node: any)`.
 */
export type CompleteInterpreter<K extends string> = {
  [key in K]: key extends keyof NodeTypeMap
    ? Handler<NodeTypeMap[key]>
    : (node: any) => AsyncGenerator<FoldYield, unknown, unknown>;
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
