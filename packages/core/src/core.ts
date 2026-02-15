import type { InferSchema, SchemaShape } from "./schema";

// ============================================================
// MVFM — Extensible Tagless Final DSL via Proxy
// ============================================================
//
// The core idea: $ is assembled from composable plugins.
// Each plugin contributes proxy traps, AST node types, and
// type-level additions to $. The closure runs once at init
// time, building a tree — nothing executes until interpreted.
//
// ============================================================

// ---- Branding & Expr -------------------------------------

const MVFM = Symbol.for("mvfm");

/**
 * Base fields present on every Expr regardless of T.
 * Kept as an interface so the MVFM symbol key works.
 */
interface ExprBase<T> {
  readonly [MVFM]: true;
  readonly __type: T; // phantom — never read at runtime
  readonly __node: ASTNode; // the underlying AST node
}

/**
 * Conditional mapped fields for `Expr<T>`.
 *
 * - `never`        → `{}` (no property access — forces schema declaration)
 * - `T[]`          → permissive index sig (array typing deferred, see #18)
 * - Record type  → mapped `{ K: Expr<T[K]> }` (type-preserving proxy)
 * - leaf (string, number, etc.) → `{}` (no extra properties)
 */
type ExprFields<T> = [T] extends [never]
  ? {}
  : [T] extends [readonly any[]]
    ? { readonly [key: string]: any }
    : T extends Record<string, unknown>
      ? { readonly [K in keyof T as K extends `__${string}` | symbol ? never : K]: Expr<T[K]> }
      : {};

/**
 * Expr<T> is the phantom-typed wrapper around every value in
 * the DSL. At runtime it's a Proxy. At the type level it
 * carries T so your IDE gives you completions and errors.
 *
 * The brand symbol lets plugins detect "is this already a
 * Mvfm value or a raw JS primitive?"
 */
export type Expr<T> = ExprBase<T> & ExprFields<T>;

// ---- AST -------------------------------------------------

/**
 * Every AST node has a `kind` discriminant (namespaced to the
 * plugin that created it) and arbitrary fields. Plugins define
 * their own node shapes.
 */
export interface ASTNode {
  kind: string;
  __id?: number; // internal: unique ID for reachability tracking
  [key: string]: unknown;
}

let _nodeIdCounter = 0;
function nextNodeId(): number {
  return ++_nodeIdCounter;
}

/**
 * A Program is what mvfm() returns — the complete AST plus
 * a hash for verification.
 */
export interface Program {
  ast: ASTNode;
  hash: string;
  plugins: string[];
  inputSchema: Record<string, unknown>;
}

// ---- Plugin Interface ------------------------------------

/**
 * A Plugin is a function that receives the proxy builder
 * context and returns:
 *
 *   name      — unique namespace (e.g. "num", "str", "db")
 *   build     — called during $ construction; returns the
 *               methods/properties this plugin adds to $
 *   nodeKinds — the set of AST node kinds this plugin emits
 *               (for validation & interpreter dispatch)
 */
export interface PluginContext {
  /** Create an Expr<T> wrapping an AST node */
  expr: <T>(node: ASTNode) => Expr<T>;

  /** Auto-lift a raw JS value to Expr if it isn't already */
  lift: <T>(value: T | Expr<T>) => Expr<T>;

  /** Check if a value is already an Expr */
  isExpr: (value: unknown) => value is Expr<unknown>;

  /** Record a statement-level AST node (no return value) */
  emit: (node: ASTNode) => void;

  /** Access the current program's statement list */
  statements: ASTNode[];

  /**
   * Internal: all nodes created during closure execution.
   * Used for reachability analysis — NOT for building the AST.
   */
  _registry: Map<number, ASTNode>;

  /** All resolved plugin definitions loaded in this program */
  plugins: PluginDefinition[];

  /** Runtime schema passed via the schema overload, if any */
  inputSchema?: Record<string, unknown>;
}

/**
 * Declares a typeclass trait implementation for a plugin's type.
 *
 * Maps a runtime type string (e.g. `"number"`) to the AST node kinds
 * that implement each operation in the trait.
 */
export interface TraitImpl {
  type: string;
  nodeKinds: Record<string, string>;
}

/**
 * Phantom marker: a typeclass plugin's contribution depends on which
 * type plugins provide implementations for the named trait.
 * @internal
 */
export interface TypeclassSlot<Name extends string> {
  readonly __typeclassSlot: Name;
}

/**
 * Error type injected when a typeclass plugin is used without any
 * type plugin providing the required trait.
 * @internal
 */
export interface MissingTraitError<_TraitName extends string, Hint extends string> {
  /** @deprecated This typeclass has no provider — see Hint. */
  readonly __error: Hint;
}

/**
 * Registry mapping trait names to their generic template types.
 * Extended by typeclass plugins via declaration merging.
 * @internal
 */
// biome-ignore lint/correctness/noUnusedVariables: T is used by module augmentation
export interface TypeclassMapping<T> {}

/**
 * Defines a plugin's contract: its name, the AST node kinds it emits,
 * and a build function that returns the methods it contributes to `$`.
 *
 * @example
 * ```ts
 * const myPlugin: PluginDefinition<MyMethods> = {
 *   name: "my",
 *   nodeKinds: ["my/op"],
 *   build(ctx) { return { op: (a) => ctx.expr({ kind: "my/op", a: ctx.lift(a).__node }) }; }
 * };
 * ```
 */
// biome-ignore lint/correctness/noUnusedVariables: Traits is reserved for trait-based plugin dispatch
export interface PluginDefinition<T = any, Traits extends Record<string, unknown> = {}> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
  traits?: {
    eq?: TraitImpl;
    ord?: TraitImpl;
    semiring?: TraitImpl;
    heytingAlgebra?: TraitImpl;
    show?: TraitImpl;
    semigroup?: TraitImpl;
    monoid?: TraitImpl;
    bounded?: TraitImpl;
  };
}

/**
 * A plugin export: either a bare PluginDefinition or a factory
 * function that returns one (for plugins requiring configuration).
 */
export type Plugin<T = any, Traits extends Record<string, unknown> = {}> =
  | PluginDefinition<T, Traits>
  | (() => PluginDefinition<T, Traits>);

// ---- Interpreter Interface -------------------------------

/**
 * A generator-based interpreter fragment that yields effects
 * instead of directly calling a recurse callback.
 *
 * Generator fragments enable the step evaluator to pause, inspect,
 * and resume evaluation — the foundation for middleware, debugging,
 * and IO interception.
 *
 * Each plugin can ship its own interpreter fragment, and they compose
 * via {@link composeInterpreters} or {@link foldAST}.
 */
export interface InterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode) => Generator<StepEffect, unknown, unknown>;
  /** Returns true if the node should never be cached (e.g., lambda params). */
  isVolatile?: (node: ASTNode) => boolean;
}

/**
 * An interpreter is a function that takes a {@link Program} and returns
 * a runner with an async `run` method.
 */
export type Interpreter = (program: Program) => {
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

/**
 * A callable interpreter function returned by {@link composeInterpreters}.
 *
 * Evaluates an AST node using the composed interpreter fragments, with
 * WeakMap-based memoization so shared (DAG) references are only evaluated once.
 *
 * Call `fresh()` to obtain a new instance with an empty cache — used by
 * retry logic so each attempt re-executes from scratch.
 */
export interface RecurseFn {
  /** Evaluate an AST node, returning its result. Memoized by object identity. */
  (node: ASTNode): Promise<unknown>;
  /** Create a new RecurseFn with a fresh (empty) memoization cache. */
  fresh(): RecurseFn;
}

// ---- Step Evaluator Types --------------------------------

/**
 * Describes a side effect produced during AST evaluation.
 *
 * A `"recurse"` effect signals the evaluator to descend into a child node.
 * Any other `type` string represents an IO or custom effect to be handled
 * externally (e.g., `"query"`, `"http"`, `"log"`).
 */
export type StepEffect =
  | { type: "recurse"; child: ASTNode }
  | { type: string; [key: string]: unknown };

/**
 * Contextual information about the current position in the AST
 * during step-by-step evaluation.
 */
export interface StepContext {
  /** How many levels deep from the root this evaluation is. */
  depth: number;
  /** Path of node kinds from root to the current node. */
  path: string[];
  /** The parent AST node, if any. */
  parentNode?: ASTNode;
}

/**
 * A single step in the evaluation of an AST node.
 *
 * When `done` is `true`, the node has been fully evaluated and
 * `value` contains the result.  When `done` is `false`, the evaluator
 * has yielded an effect that must be resolved before evaluation can
 * continue.
 *
 * @typeParam S - User-defined state threaded through the evaluation.
 */
export type Step<S> =
  | { done: true; value: unknown; state: S }
  | {
      done: false;
      node: ASTNode;
      effect: StepEffect;
      context: StepContext;
      state: S;
    };

/**
 * Handles an effect produced during AST evaluation, returning
 * the resolved value and updated state.
 *
 * @typeParam S - User-defined state threaded through the evaluation.
 */
export type StepHandler<S> = (
  effect: StepEffect,
  context: StepContext,
  state: S,
) => Promise<{ value: unknown; state: S }>;

// ---- Interpreter Fragment Types --------------------------

/**
 * A legacy interpreter fragment using callback-based recursion.
 *
 * This type exists only for backward compatibility with {@link adaptLegacy}.
 * New code should use {@link InterpreterFragment} (generator-based).
 */
export interface LegacyInterpreterFragment {
  pluginName: string;
  canHandle: (node: ASTNode) => boolean;
  visit: (node: ASTNode, recurse: (node: ASTNode) => Promise<unknown>) => Promise<unknown>;
}

/**
 * Type alias for backward compatibility.
 *
 * `GeneratorInterpreterFragment` is now identical to {@link InterpreterFragment}.
 * New code should use `InterpreterFragment` directly.
 *
 * @deprecated Use {@link InterpreterFragment} instead.
 */
export type GeneratorInterpreterFragment = InterpreterFragment;

/**
 * Wraps a {@link LegacyInterpreterFragment} as an {@link InterpreterFragment}.
 *
 * The adapted fragment yields a single `__legacy` effect, which the
 * evaluator intercepts and executes using the original callback-based
 * `visit` method.
 */
export function adaptLegacy(fragment: LegacyInterpreterFragment): InterpreterFragment {
  return {
    pluginName: fragment.pluginName,
    canHandle: fragment.canHandle,
    *visit(node: ASTNode): Generator<StepEffect, unknown, unknown> {
      return yield { type: "__legacy", fragment, node } as StepEffect;
    },
  };
}

// ---- Stepper Class ---------------------------------------

interface StackFrame {
  gen: Generator<StepEffect, unknown, unknown>;
  node: ASTNode;
  parentNode?: ASTNode;
}

/**
 * A trampoline-based AST evaluator that advances one step at a time.
 *
 * The Stepper maintains an explicit stack of generator frames on the heap,
 * enabling step-by-step evaluation with full control over scheduling,
 * caching, and effect interception.
 *
 * Use {@link runAST} or {@link foldAST} for higher-level evaluation;
 * the Stepper is exposed for advanced use cases (debuggers, profilers).
 */
export class Stepper {
  private stack: StackFrame[] = [];
  private cache = new WeakMap<ASTNode, unknown>();
  private tainted = new WeakSet<ASTNode>();
  private fragments: InterpreterFragment[];

  constructor(fragments: InterpreterFragment[], root: ASTNode) {
    this.fragments = fragments;
    this.pushNode(root, undefined);
  }

  private pushNode(node: ASTNode, parentNode: ASTNode | undefined): void {
    const fragment = this.fragments.find((f) => f.canHandle(node));
    if (!fragment) {
      throw new Error(`No interpreter for node kind: ${node.kind}`);
    }
    const gen = fragment.visit(node);
    this.stack.push({ gen, node, parentNode });
  }

  private isNodeVolatile(node: ASTNode): boolean {
    if (isVolatileDefault(node)) return true;
    for (const f of this.fragments) {
      if (f.isVolatile && f.canHandle(node) && f.isVolatile(node)) return true;
    }
    return false;
  }

  /**
   * Push a child node onto the evaluation stack (descend into it).
   *
   * If the child has a cached result and is not tainted, returns
   * the cached value immediately via a done step.
   */
  descend(child: ASTNode, parentNode: ASTNode | undefined): Step<undefined> | null {
    if (!this.tainted.has(child) && this.cache.has(child)) {
      // Return cached value without pushing a frame
      return { done: true, value: this.cache.get(child), state: undefined };
    }
    this.pushNode(child, parentNode);
    return null;
  }

  /**
   * Advance the evaluation by one step.
   *
   * @param lastResult - The resolved value of the previous effect (if any).
   * @returns A {@link Step} describing what happened, or `null` if evaluation is complete.
   */
  tick(lastResult?: unknown): Step<undefined> | null {
    if (this.stack.length === 0) return null;

    const frame = this.stack[this.stack.length - 1];
    const result = frame.gen.next(lastResult);

    if (result.done) {
      // Generator finished — pop frame
      this.stack.pop();
      const value = result.value;

      // Cache unless volatile or tainted
      if (!this.isNodeVolatile(frame.node) && !hasAnyTaintedChild(frame.node, this.tainted)) {
        this.cache.set(frame.node, value);
      } else {
        this.tainted.add(frame.node);
        this.cache.delete(frame.node);
      }

      if (this.stack.length === 0) {
        // Root evaluation complete
        return { done: true, value, state: undefined };
      }

      // Feed value back to parent generator on next tick
      return this.tick(value);
    }

    // Generator yielded an effect
    const effect = result.value as StepEffect;
    const context: StepContext = {
      depth: this.stack.length - 1,
      path: this.stack.map((f) => f.node.kind),
      parentNode: frame.parentNode,
    };

    if (effect.type === "recurse") {
      const child = (effect as { type: "recurse"; child: ASTNode }).child;
      const cached = this.descend(child, frame.node);
      if (cached?.done) {
        // Cache hit — feed the cached value back immediately
        return this.tick(cached.value);
      }
      // Pushed a new frame; advance it
      return this.tick(undefined);
    }

    // Non-recurse effect — yield to caller
    return {
      done: false,
      node: frame.node,
      effect,
      context,
      state: undefined,
    };
  }

  /**
   * Create a new Stepper for the given root with an empty cache.
   */
  fresh(root: ASTNode): Stepper {
    return new Stepper(this.fragments, root);
  }
}

// ---- runAST (Level 1) ------------------------------------

/**
 * Evaluate an AST using generator-based fragments with a custom
 * effect handler.
 *
 * `runAST` auto-handles `recurse` effects by descending into child
 * nodes. All other effects (IO, custom) are delegated to the provided
 * StepHandler. The `"__legacy"` effect is handled internally
 * for backward compatibility with {@link LegacyInterpreterFragment}s.
 *
 * @typeParam S - User-defined state threaded through the evaluation.
 * @param root - The root AST node to evaluate.
 * @param fragments - Interpreter fragments.
 * @param handler - Handler for non-recurse effects.
 * @param initialState - Initial user state.
 * @returns The final value and state after evaluation.
 */
export async function runAST<S>(
  root: ASTNode,
  fragments: InterpreterFragment[],
  handler: StepHandler<S>,
  initialState: S,
): Promise<{ value: unknown; state: S }> {
  let state = initialState;

  // We use a manual trampoline instead of the Stepper class because
  // we need to thread state through legacy callbacks and handlers.
  const cache = new WeakMap<ASTNode, unknown>();
  const taintedSet = new WeakSet<ASTNode>();

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
        // Handle legacy fragment callback
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
        // IO / custom effect — delegate to handler
        const context: StepContext = {
          depth: 0, // Simplified for runAST
          path: [node.kind],
          parentNode: undefined,
        };
        const handlerResult = await handler(effect, context, state);
        state = handlerResult.state;
        input = handlerResult.value;
      }
    }
  }

  const value = await evaluate(root);
  return { value, state };
}

// ---- foldAST (Level 2) -----------------------------------

/**
 * Build a {@link RecurseFn} from generator-based fragments and a
 * map of effect handlers.
 *
 * `foldAST` is the generator-based replacement for
 * {@link composeInterpreters}. It returns a `RecurseFn` with the
 * same API (callable + `.fresh()`), so it can be used as a drop-in
 * replacement in existing interpreter pipelines.
 *
 * @param fragments - Interpreter fragments.
 * @param handlers - Map from effect type string to async handler function.
 *                   Each handler receives the effect and returns a value.
 * @returns A {@link RecurseFn} that evaluates AST nodes.
 */
export function foldAST(
  fragments: InterpreterFragment[],
  handlers: Record<string, (effect: StepEffect) => Promise<unknown>>,
): RecurseFn {
  const handler: StepHandler<undefined> = async (effect, _context, state) => {
    const h = handlers[effect.type];
    if (!h) {
      throw new Error(`No handler for effect type: ${effect.type}`);
    }
    const value = await h(effect);
    return { value, state };
  };

  const cache = new WeakMap<ASTNode, unknown>();
  const taintedSet = new WeakSet<ASTNode>();

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

  async function recurse(node: ASTNode): Promise<unknown> {
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
          input = await recurse(child);
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
          input = await legacyEffect.fragment.visit(legacyEffect.node, recurse);
        } catch (e) {
          input = e;
          isError = true;
        }
      } else {
        const resolved = await handler(effect, { depth: 0, path: [node.kind] }, undefined);
        input = resolved.value;
      }
    }
  }

  (recurse as RecurseFn).fresh = () => foldAST(fragments, handlers);

  return recurse as RecurseFn;
}

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
 * Compose interpreter fragments into a full interpreter.
 * Uses WeakMap memoization so shared AST nodes (DAG references)
 * are only evaluated once. Volatile nodes (lambda_param, cursor_batch)
 * are tracked as "tainted" and their ancestors are not cached.
 *
 * Delegates to {@link foldAST} with no effect handlers — all effects
 * are expected to be `recurse` (or `__legacy` from adapted fragments).
 * For IO effects, use {@link foldAST} directly with handlers.
 */
export function composeInterpreters(fragments: InterpreterFragment[]): RecurseFn {
  return foldAST(fragments, {});
}

// ---- The Proxy Engine ------------------------------------

function isExpr(value: unknown): value is Expr<unknown> {
  return value !== null && typeof value === "object" && MVFM in (value as Record<symbol, unknown>);
}

function autoLift<T>(value: T | Expr<T>, exprFn: PluginContext["expr"]): Expr<T> {
  if (isExpr(value)) return value as Expr<T>;

  // Raw primitive — auto-lift to a Literal node
  const jsType = typeof value;
  if (jsType === "number" || jsType === "string" || jsType === "boolean" || value === null) {
    return exprFn<T>({ kind: "core/literal", value });
  }

  // Raw array of Exprs — lift to a Tuple node
  if (Array.isArray(value)) {
    return exprFn<T>({
      kind: "core/tuple",
      elements: value.map((v) => autoLift(v, exprFn).__node),
    });
  }

  // Raw object with Expr values — lift to a Record node
  if (jsType === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      isExpr(v) ? (v as Expr<unknown>).__node : autoLift(v, exprFn).__node,
    ]);
    return exprFn<T>({
      kind: "core/record",
      fields: Object.fromEntries(entries),
    });
  }

  throw new Error(`Cannot auto-lift value of type ${jsType} into Mvfm expression`);
}

/**
 * Make an Expr<T> proxy that intercepts property access to
 * build PropAccess nodes, and method calls to build
 * MethodCall nodes. This is what makes `user.firstName` and
 * `posts.filter(...)` work.
 */
function makeExprProxy<T>(node: ASTNode, ctx: PluginContext): Expr<T> {
  const target = {
    [MVFM]: true as const,
    __type: undefined as unknown as T,
    __node: node,
  };

  return new Proxy(target, {
    get(_target, prop) {
      // Internal access — return real values
      if (prop === MVFM) return true;
      if (prop === "__node") return node;
      if (prop === "__type") return undefined;

      // Symbol access — pass through
      if (typeof prop === "symbol") return undefined;

      // Array-like methods that take callbacks
      const callbackMethods = [
        "map",
        "filter",
        "reduce",
        "find",
        "findIndex",
        "some",
        "every",
        "flatMap",
        "forEach",
      ];

      if (callbackMethods.includes(prop)) {
        return (...args: unknown[]) => {
          // Callbacks get wrapped: we invoke them with a fresh
          // proxy representing the lambda parameter, and capture
          // the returned AST node.
          const processedArgs = args.map((arg, i) => {
            if (typeof arg === "function") {
              // Create proxy params for the callback
              const paramNode: ASTNode = {
                kind: "core/lambda_param",
                index: i,
                parentMethod: prop,
              };
              const paramProxy = makeExprProxy(paramNode, ctx);

              // For reduce, second arg to callback is accumulator
              if (prop === "reduce" && args.length > 1 && i === 0) {
                const accNode: ASTNode = {
                  kind: "core/lambda_param",
                  name: "accumulator",
                };
                const accProxy = makeExprProxy(accNode, ctx);
                const itemNode: ASTNode = {
                  kind: "core/lambda_param",
                  name: "item",
                };
                const itemProxy = makeExprProxy(itemNode, ctx);
                const result = (arg as Function)(accProxy, itemProxy);
                return {
                  kind: "core/lambda" as const,
                  params: [accNode, itemNode],
                  body: isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node,
                };
              }

              const result = (arg as Function)(paramProxy);
              return {
                kind: "core/lambda" as const,
                params: [paramNode],
                body: isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node,
              };
            }
            // Non-callback args (like initial value for reduce)
            return isExpr(arg)
              ? (arg as Expr<unknown>).__node
              : { kind: "core/literal", value: arg };
          });

          return makeExprProxy(
            {
              kind: "core/method_call",
              receiver: node,
              method: prop,
              args: processedArgs,
            },
            ctx,
          );
        };
      }

      // .length and other property access
      return makeExprProxy<unknown>(
        {
          kind: "core/prop_access",
          object: node,
          property: prop,
        },
        ctx,
      );
    },
  }) as unknown as Expr<T>;
}

// ---- mvfm() — the main entry point ----------------------

// ---- Type-level trait resolution ----

/** Extract the methods type T from a plugin or factory */
type ExtractPluginType<P> =
  P extends PluginDefinition<infer T, any>
    ? T
    : P extends (...args: any[]) => PluginDefinition<infer T, any>
      ? T
      : {};

/** Extract the Traits record from a plugin or factory */
type ExtractPluginTraits<P> =
  P extends PluginDefinition<any, infer Traits>
    ? Traits
    : P extends (...args: any[]) => PluginDefinition<any, infer Traits>
      ? Traits
      : {};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/** Collect trait type for a specific trait name K across all plugins */
type CollectTrait<Plugins extends readonly any[], K extends string> =
  ExtractPluginTraits<Plugins[number]> extends infer AllTraits
    ? AllTraits extends Record<string, unknown>
      ? K extends keyof AllTraits
        ? AllTraits[K]
        : never
      : never
    : never;

/**
 * Resolve a single plugin's contribution to $.
 * Regular plugins: pass through T unchanged.
 * TypeclassSlot plugins: resolve against collected traits via TypeclassMapping.
 */
type ResolvePlugin<P, Plugins extends readonly any[]> =
  ExtractPluginType<P> extends TypeclassSlot<infer Name>
    ? Name extends keyof TypeclassMapping<any>
      ? [CollectTrait<Plugins, Name>] extends [never]
        ? MissingTraitError<
            Name,
            `No plugin provides trait '${Name}'. Include a type plugin that registers it.`
          >
        : UnionToIntersection<
            CollectTrait<Plugins, Name> extends infer T
              ? T extends any
                ? TypeclassMapping<T>[Name]
                : never
              : never
          >
      : MissingTraitError<
          Name,
          `No plugin provides trait '${Name}'. Include a type plugin that registers it.`
        >
    : ExtractPluginType<P>;

type MergePlugins<Plugins extends readonly any[]> = UnionToIntersection<
  ResolvePlugin<Plugins[number], Plugins>
>;

// Core $ methods that are always available
interface CoreDollar<I = never> {
  /** Input parameters to the program — typed when I is provided */
  input: Expr<I>;

  /** Conditional branching (returns a branch builder) */
  cond(predicate: Expr<boolean>): {
    t: (then: Expr<any> | any) => { f: (els: Expr<any> | any) => Expr<any> };
    f: (els: Expr<any> | any) => { t: (then: Expr<any> | any) => Expr<any> };
  };

  /**
   * Sequence side effects with a final return value.
   * All arguments are included in the program.
   * Last argument is the return value of the sequence.
   *
   *   return $.do(
   *     $.db.exec('UPDATE ...', []),
   *     $.kv.set('key', value),
   *     user   // ← returned
   *   )
   */
  do(...exprs: (Expr<any> | any)[]): Expr<any>;

  /**
   * Recursion via Y combinator. The callback receives `self`
   * (a function that produces recursive call nodes) and `param`
   * (the input to the recursive function).
   *
   *   const factorial = app(($) =>
   *     $.rec((self, n) =>
   *       $.cond($.eq(n, 0)).t(1).f($.mul(n, self($.sub(n, 1))))
   *     )
   *   )
   */
  rec<T, R>(fn: (self: (arg: Expr<T> | T) => Expr<R>, param: Expr<T>) => Expr<R> | R): Expr<R>;
}

/**
 * Create a mvfm program builder with the given plugins.
 *
 * Usage:
 *   `const serverless = mvfm(num, str, db('postgres://...'))`
 *   `const myProgram = serverless(($) => { ... })`
 */
export function mvfm<P extends PluginDefinition<any, any>[]>(...plugins: P) {
  function define<S extends SchemaShape>(
    schema: S,
    fn: ($: CoreDollar<InferSchema<S>> & MergePlugins<P>) => Expr<any> | any,
  ): Program;
  function define<I = never>(fn: ($: CoreDollar<I> & MergePlugins<P>) => Expr<any> | any): Program;
  function define(schemaOrFn: SchemaShape | (($: any) => any), maybeFn?: ($: any) => any): Program {
    const schema = typeof schemaOrFn === "function" ? undefined : (schemaOrFn as SchemaShape);
    const fn = typeof schemaOrFn === "function" ? schemaOrFn : maybeFn!;

    const statements: ASTNode[] = [];
    const registry = new Map<number, ASTNode>(); // id -> node

    // Resolve plugins BEFORE building ctx
    const resolvedPlugins = plugins.map((p) =>
      typeof p === "function" && !("name" in p) ? (p as () => PluginDefinition<any, any>)() : p,
    ) as PluginDefinition<any, any>[];

    // Build the plugin context
    const ctx: PluginContext = {
      expr: <T>(node: ASTNode) => {
        const id = nextNodeId();
        node.__id = id;
        registry.set(id, node);
        return makeExprProxy<T>(node, ctx);
      },
      lift: <T>(value: T | Expr<T>) => autoLift(value, ctx.expr),
      isExpr,
      emit: (node: ASTNode) => statements.push(node),
      statements,
      _registry: registry,
      plugins: resolvedPlugins,
      inputSchema: schema,
    };

    // Build core $ methods
    const core: CoreDollar<any> = {
      input: makeExprProxy<any>({ kind: "core/input" }, ctx),

      cond(predicate: Expr<boolean>) {
        let thenNode: ASTNode | null = null;
        let elseNode: ASTNode | null = null;

        const makeResult = () => {
          if (thenNode && elseNode) {
            return makeExprProxy(
              {
                kind: "core/cond",
                predicate: predicate.__node,
                then: thenNode,
                else: elseNode,
              },
              ctx,
            );
          }
        };

        return {
          t: <T>(then: Expr<T> | T) => {
            thenNode = isExpr(then) ? then.__node : autoLift(then, ctx.expr).__node;
            return {
              f: <U>(els: Expr<U> | U) => {
                elseNode = isExpr(els) ? els.__node : autoLift(els, ctx.expr).__node;
                return makeResult()!;
              },
            };
          },
          f: <U>(els: Expr<U> | U) => {
            elseNode = isExpr(els) ? els.__node : autoLift(els, ctx.expr).__node;
            return {
              t: <T>(then: Expr<T> | T) => {
                thenNode = isExpr(then) ? then.__node : autoLift(then, ctx.expr).__node;
                return makeResult()!;
              },
            };
          },
        };
      },

      do(...exprs: (Expr<any> | any)[]) {
        const nodes = exprs.map((e) => (isExpr(e) ? e.__node : autoLift(e, ctx.expr).__node));
        const steps = nodes.slice(0, -1);
        const result = nodes[nodes.length - 1];
        return makeExprProxy(
          {
            kind: "core/do",
            steps,
            result,
          },
          ctx,
        );
      },

      rec<T, R>(fn: (self: (arg: Expr<T> | T) => Expr<R>, param: Expr<T>) => Expr<R> | R): Expr<R> {
        const recId = `rec_${nextNodeId()}`;
        const paramNode: ASTNode = { kind: "core/lambda_param", name: "rec_param" };
        const paramProxy = makeExprProxy<T>(paramNode, ctx);

        // `self` is a function that produces rec_call nodes
        const self = (arg: Expr<T> | T): Expr<R> => {
          const argNode = isExpr(arg) ? arg.__node : autoLift(arg, ctx.expr).__node;
          return makeExprProxy<R>({ kind: "core/rec_call", recId, arg: argNode }, ctx);
        };

        const result = fn(self, paramProxy);
        const bodyNode = isExpr(result) ? result.__node : autoLift(result, ctx.expr).__node;

        return makeExprProxy<R>(
          {
            kind: "core/rec",
            recId,
            param: paramNode,
            body: bodyNode,
          },
          ctx,
        );
      },
    };

    // Build each plugin's contribution to $
    const pluginContributions = resolvedPlugins.reduce(
      (acc, plugin) => {
        const contribution = plugin.build(ctx);
        return { ...acc, ...contribution };
      },
      {} as Record<string, unknown>,
    );

    // Assemble $
    const dollar = { ...core, ...pluginContributions } as CoreDollar<any> & MergePlugins<P>;

    // Run the closure — this builds the AST
    const result = fn(dollar);
    const resultNode = isExpr(result)
      ? (result as Expr<unknown>).__node
      : autoLift(result, ctx.expr).__node;

    // Build the final program
    const ast: ASTNode = {
      kind: "core/program",
      statements,
      result: resultNode,
    };

    // ---- Reachability analysis ----------------------------
    // Walk the return tree + statements, collect all reachable
    // node IDs. Anything in the registry that isn't reachable
    // is an orphaned side effect — error out.
    const reachableIds = new Set<number>();

    function walkNode(node: unknown): void {
      if (node === null || node === undefined) return;
      if (typeof node !== "object") return;

      // If it's an array, walk each element
      if (Array.isArray(node)) {
        for (const item of node) {
          walkNode(item);
        }
        return;
      }

      const obj = node as Record<string, unknown>;

      // If it's an ASTNode (has a `kind`), mark it reachable by ID
      if ("kind" in obj) {
        const astNode = obj as ASTNode;
        if (astNode.__id !== undefined) {
          if (reachableIds.has(astNode.__id)) return; // already visited
          reachableIds.add(astNode.__id);
        }
      }

      // Walk ALL values in the object — whether it's an ASTNode
      // or a plain object like record fields
      for (const [key, value] of Object.entries(obj)) {
        if (key === "__id") continue;
        walkNode(value);
      }
    }

    // Walk from the program root
    walkNode(ast);

    // Find orphans — registered nodes not reachable from root
    const orphans: ASTNode[] = [];
    for (const [id, node] of registry) {
      if (!reachableIds.has(id) && !isInternalNode(node)) {
        orphans.push(node);
      }
    }

    if (orphans.length > 0) {
      const details = orphans
        .map((n) => `  - ${n.kind}${n.sql ? `: ${n.sql}` : ""}${n.url ? `: ${n.url}` : ""}`)
        .join("\n");
      throw new Error(
        `Mvfm build error: ${orphans.length} unreachable node(s) detected.\n` +
          `These expressions were created but are not part of the return tree.\n` +
          `Wrap side effects in $.do():\n\n` +
          `  return $.do(\n` +
          `    $.db.exec('...'),  // side effect\n` +
          `    result             // return value\n` +
          `  )\n\n` +
          `Orphaned nodes:\n${details}`,
      );
    }

    // Simple hash (in production, use SHA-256)
    // Strip __id and recId fields before hashing — they're internal
    // counters that would cause identical programs to hash differently.
    const hash = simpleHash(
      JSON.stringify(ast, (key, value) => (key === "__id" || key === "recId" ? undefined : value)),
    );

    return {
      ast,
      hash,
      plugins: resolvedPlugins.map((p) => p.name),
      inputSchema: schema ?? {},
    };
  }

  return define;
}

/**
 * Internal/structural nodes that don't represent user-visible
 * effects and shouldn't trigger orphan warnings.
 */
function isInternalNode(node: ASTNode): boolean {
  return (
    node.kind === "core/input" ||
    node.kind === "core/literal" ||
    node.kind === "core/lambda_param" ||
    node.kind.startsWith("st/")
  );
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Walk an AST subtree and inject a runtime value into matching `core/lambda_param` nodes.
 *
 * This is the standard mechanism for evaluating lambda expressions at runtime:
 * clone the lambda body, inject the argument value into the param nodes, then
 * recurse through the interpreter to evaluate the body.
 *
 * @param node - AST subtree to walk (typically a cloned lambda body)
 * @param name - The param name to match against `core/lambda_param` nodes
 * @param value - The runtime value to inject
 */
export function injectLambdaParam(node: any, name: string, value: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) injectLambdaParam(item, name, value);
    return;
  }
  if (node.kind === "core/lambda_param" && node.name === name) {
    node.__value = value;
  }
  for (const v of Object.values(node)) {
    if (typeof v === "object" && v !== null) {
      injectLambdaParam(v, name, value);
    }
  }
}
