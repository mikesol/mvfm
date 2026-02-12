// ============================================================
// ILO — Extensible Tagless Final DSL via Proxy
// ============================================================
//
// The core idea: $ is assembled from composable plugins.
// Each plugin contributes proxy traps, AST node types, and
// type-level additions to $. The closure runs once at init
// time, building a tree — nothing executes until interpreted.
//
// ============================================================

// ---- Branding & Expr -------------------------------------

const ILO = Symbol.for("ilo");

/**
 * Expr<T> is the phantom-typed wrapper around every value in
 * the DSL. At runtime it's a Proxy. At the type level it
 * carries T so your IDE gives you completions and errors.
 *
 * The brand symbol lets plugins detect "is this already a
 * Ilo value or a raw JS primitive?"
 */
export interface Expr<T> {
  readonly [ILO]: true;
  readonly __type: T; // phantom — never read at runtime
  readonly __node: ASTNode; // the underlying AST node
  // Proxy makes all property access work at runtime.
  // This index sig tells TS "trust me, any prop returns an Expr"
  readonly [key: string]: any;
}

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
 * A Program is what ilo() returns — the complete AST plus
 * a hash for verification.
 */
export interface Program {
  ast: ASTNode;
  hash: string;
  plugins: string[];
  inputSchema: Record<string, string>;
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
}

export interface PluginDefinition<T = any> {
  name: string;
  nodeKinds: string[];
  build: (ctx: PluginContext) => T;
}

/**
 * A PluginFactory is what users import and optionally configure.
 *
 *   import { db } from 'ilo/plugins/db'
 *   const myStack = ilo(num, str, db('postgres://...'))
 *
 * Plugins with no config are just bare PluginDefinition factories.
 * Plugins with config are functions that return a PluginDefinition.
 */
export type Plugin<T = any> = PluginDefinition<T> | (() => PluginDefinition<T>);

// ---- Interpreter Interface -------------------------------

/**
 * An Interpreter is a visitor over AST nodes. Each plugin
 * can ship its own interpreter fragment, and they compose.
 */
export interface InterpreterFragment {
  pluginName: string;
  visit: (node: ASTNode, recurse: (node: ASTNode) => unknown) => unknown;
  canHandle: (node: ASTNode) => boolean;
}

export type Interpreter = (program: Program) => {
  run: (input: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Compose interpreter fragments into a full interpreter.
 */
export function composeInterpreters(fragments: InterpreterFragment[]): (node: ASTNode) => unknown {
  return function recurse(node: ASTNode): unknown {
    const fragment = fragments.find((f) => f.canHandle(node));
    if (!fragment) {
      throw new Error(`No interpreter for node kind: ${node.kind}`);
    }
    return fragment.visit(node, recurse);
  };
}

// ---- The Proxy Engine ------------------------------------

function isExpr(value: unknown): value is Expr<unknown> {
  return value !== null && typeof value === "object" && ILO in (value as Record<symbol, unknown>);
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
      elements: value.map((v) => autoLift(v, exprFn)),
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

  throw new Error(`Cannot auto-lift value of type ${jsType} into Ilo expression`);
}

/**
 * Make an Expr<T> proxy that intercepts property access to
 * build PropAccess nodes, and method calls to build
 * MethodCall nodes. This is what makes `user.firstName` and
 * `posts.filter(...)` work.
 */
function makeExprProxy<T>(node: ASTNode, ctx: PluginContext): Expr<T> {
  const target = {
    [ILO]: true as const,
    __type: undefined as unknown as T,
    __node: node,
  };

  return new Proxy(target, {
    get(_target, prop) {
      // Internal access — return real values
      if (prop === ILO) return true;
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

// ---- ilo() — the main entry point ----------------------

type ExtractPluginType<P> =
  P extends PluginDefinition<infer T>
    ? T
    : P extends (...args: any[]) => PluginDefinition<infer T>
      ? T
      : {};

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type MergePlugins<Plugins extends readonly any[]> = UnionToIntersection<
  ExtractPluginType<Plugins[number]>
>;

// Core $ methods that are always available
interface CoreDollar {
  /** Input parameters to the program */
  input: Expr<Record<string, unknown>>;

  /** Conditional branching (returns a branch builder) */
  cond(predicate: Expr<boolean>): {
    t: (then: Expr<any> | any) => { f: (els: Expr<any> | any) => Expr<any> };
    f: (els: Expr<any> | any) => { t: (then: Expr<any> | any) => Expr<any> };
  };

  /** Equality */
  eq<T>(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean>;

  /** Boolean operators */
  and(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  or(a: Expr<boolean>, b: Expr<boolean>): Expr<boolean>;
  not(a: Expr<boolean>): Expr<boolean>;

  /** Mutable binding */
  let<T>(initial: Expr<T> | T): {
    get: () => Expr<T>;
    set: (value: Expr<T> | T) => void;
    push: (value: Expr<T>) => void; // for arrays
  };

  /** Iteration (statement-level) */
  each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void): void;

  /** While loop */
  while(condition: Expr<boolean>): {
    body: (...statements: unknown[]) => void;
  };

  /** No-op */
  noop: Expr<void>;

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
 * Create a ilo program builder with the given plugins.
 *
 * Usage:
 *   const serverless = ilo(num, str, db('postgres://...'))
 *   const myProgram = serverless(($) => { ... })
 */
export function ilo<P extends PluginDefinition<any>[]>(...plugins: P) {
  return function define<R>(fn: ($: CoreDollar & MergePlugins<P>) => Expr<R> | R): Program {
    const statements: ASTNode[] = [];
    const registry = new Map<number, ASTNode>(); // id -> node

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
    };

    // Build core $ methods
    const core: CoreDollar = {
      input: makeExprProxy<Record<string, unknown>>({ kind: "core/input" }, ctx),

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

      eq<T>(a: Expr<T> | T, b: Expr<T> | T): Expr<boolean> {
        return makeExprProxy<boolean>(
          {
            kind: "core/eq",
            left: ctx.lift(a).__node,
            right: ctx.lift(b).__node,
          },
          ctx,
        );
      },

      and(a, b) {
        return makeExprProxy<boolean>({ kind: "core/and", left: a.__node, right: b.__node }, ctx);
      },

      or(a, b) {
        return makeExprProxy<boolean>({ kind: "core/or", left: a.__node, right: b.__node }, ctx);
      },

      not(a) {
        return makeExprProxy<boolean>({ kind: "core/not", operand: a.__node }, ctx);
      },

      let<T>(initial: Expr<T> | T) {
        const ref = `let_${statements.length}`;
        const initNode = ctx.lift(initial).__node;
        ctx.emit({ kind: "core/let", ref, initial: initNode });

        return {
          get: () => makeExprProxy<T>({ kind: "core/let_get", ref }, ctx),
          set: (value: Expr<T> | T) =>
            ctx.emit({
              kind: "core/let_set",
              ref,
              value: ctx.lift(value).__node,
            }),
          push: (value: Expr<T>) =>
            ctx.emit({
              kind: "core/let_push",
              ref,
              value: value.__node,
            }),
        };
      },

      each<T>(collection: Expr<T[]>, body: (item: Expr<T>) => void) {
        const paramNode: ASTNode = { kind: "core/lambda_param", name: "item" };
        const paramProxy = makeExprProxy<T>(paramNode, ctx);
        const prevLen = statements.length;
        body(paramProxy);
        const bodyStatements = statements.splice(prevLen);
        ctx.emit({
          kind: "core/each",
          collection: collection.__node,
          param: paramNode,
          body: bodyStatements,
        });
      },

      while(condition: Expr<boolean>) {
        return {
          body: (..._stmts: unknown[]) => {
            ctx.emit({
              kind: "core/while",
              condition: condition.__node,
              body: _stmts.filter((s) => isExpr(s)).map((s) => (s as Expr<unknown>).__node),
            });
          },
        };
      },

      noop: makeExprProxy<void>({ kind: "core/noop" }, ctx),

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

    // Resolve plugins
    const resolvedPlugins = plugins.map((p) =>
      typeof p === "function" && !("name" in p) ? (p as () => PluginDefinition<any>)() : p,
    ) as PluginDefinition<any>[];

    // Build each plugin's contribution to $
    const pluginContributions = resolvedPlugins.reduce(
      (acc, plugin) => {
        const contribution = plugin.build(ctx);
        return { ...acc, ...contribution };
      },
      {} as Record<string, unknown>,
    );

    // Assemble $
    const dollar = { ...core, ...pluginContributions } as CoreDollar & MergePlugins<P>;

    // Run the closure — this builds the AST
    const result = fn(dollar);
    const resultNode = isExpr(result)
      ? (result as Expr<R>).__node
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
        `Ilo build error: ${orphans.length} unreachable node(s) detected.\n` +
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
      inputSchema: {}, // TODO: infer from $.input usage
    };
  };
}

/**
 * Internal/structural nodes that don't represent user-visible
 * effects and shouldn't trigger orphan warnings.
 */
function isInternalNode(node: ASTNode): boolean {
  return (
    node.kind === "core/input" ||
    node.kind === "core/literal" ||
    node.kind === "core/noop" ||
    node.kind === "core/lambda_param" ||
    node.kind.startsWith("core/let")
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
