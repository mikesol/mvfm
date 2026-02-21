/**
 * Compatibility shims for external plugins still using the pre-koan API.
 *
 * These thin wrappers bridge the old surface (TypedNode, Expr, definePlugin,
 * defineInterpreter, eval_, foldAST, PluginContext, NodeTypeMap, Program)
 * to the rebuilt koan-based core. External plugins will be migrated to
 * the new API in follow-up issues; these shims keep them compiling.
 */

import type { Interpreter } from "./plugin";

// ─── TypedNode: old interpreter node type ────────────────────────────

/** Old-API node interface for interpreter handlers. Phantom-typed by T. */
export interface TypedNode<T = unknown> {
  readonly kind: string;
  readonly args?: TypedNode[];
  readonly __T?: T;
  readonly [key: string]: unknown;
}

// ─── NodeTypeMap: declaration merging target ─────────────────────────

/** Registry for typed node declarations. Plugins extend via module augmentation. */
export interface NodeTypeMap {}

// ─── Expr: old phantom-typed expression wrapper ─────────────────────

/** Old-API expression base with phantom type and AST node. */
export interface ExprBase<T> {
  readonly __type: T;
  readonly __node: TypedNode<T>;
  readonly [key: string]: unknown;
}

/** Old-API expression type with phantom typing and node access. */
export type Expr<T = unknown> = ExprBase<T>;

// ─── Program: old AST container ─────────────────────────────────────

/** Old-API program container returned by mvfm(). */
export interface Program<K extends string = string> {
  ast: unknown;
  hash: string;
  plugins: string[];
  inputSchema: Record<string, unknown>;
  readonly __kinds?: K;
}

// ─── PluginContext: old plugin build context ─────────────────────────

/** Old-API context passed to plugin build(). */
export interface PluginContext {
  lift<T>(value: T | Expr<T>): ExprBase<T>;
  expr<T>(opts: Record<string, unknown>): Expr<T>;
  isExpr(value: unknown): value is ExprBase<unknown>;
  emit(node: unknown): void;
  statements: unknown[];
  _registry: Map<number, unknown>;
  plugins: unknown[];
  inputSchema: unknown;
}

// ─── definePlugin: old plugin factory ───────────────────────────────

/** Old-API plugin factory. Returns the definition as-is. */
export function definePlugin<T extends { name: string; nodeKinds: string[] }>(def: T): T {
  return def;
}

// ─── defineInterpreter: old curried interpreter factory ──────────────

type IsAny<T> = 0 extends 1 & T ? true : false;
type ExtractNodeParam<F> = F extends (node: infer N, ...args: unknown[]) => unknown ? N : unknown;
type RejectAnyParam<_K extends string, H> = IsAny<ExtractNodeParam<H>> extends true ? never : H;

/** Handler type for a specific typed node. */
type Handler<N extends TypedNode<unknown>> =
  N extends TypedNode<infer T> ? (node: N) => AsyncGenerator<unknown, T, unknown> : never;

type InterpreterHandlers<K extends string> = string extends K
  ? Record<string, (node: any) => AsyncGenerator<unknown, unknown, unknown>>
  : {
      [P in K]: P extends keyof NodeTypeMap ? Handler<NodeTypeMap[P] & TypedNode<unknown>> : never;
    };

/** Old-API curried interpreter factory with type-safe node validation. */
export function defineInterpreter<K extends string>() {
  return <T extends InterpreterHandlers<K>>(
    handlers: string extends K
      ? T
      : T & {
          [P in K]: P extends keyof T ? RejectAnyParam<P, T[P]> : never;
        },
  ): Interpreter => handlers as unknown as Interpreter;
}

// ─── eval_: old child evaluation helper ─────────────────────────────

/** Old-API helper to evaluate a child node by yielding it to the fold. */
export async function* eval_<T>(node: TypedNode<T>): AsyncGenerator<TypedNode, T, unknown> {
  return (yield node) as T;
}

// ─── foldAST: old program fold ──────────────────────────────────────

/**
 * Old-API fold that evaluates a Program with an interpreter.
 *
 * DEFERRED: External plugins using foldAST need migration to the new
 * fold(rootId, adj, interp) API. The old Program type carried a
 * proxy-generated AST incompatible with the new CExpr/NExpr model.
 * Bridging would require defining a new Program.ast shape, which is
 * premature — each external plugin should be migrated individually.
 *
 * This shim exists so external plugins compile. It will throw at
 * runtime until the plugin is migrated to use fold() directly.
 */
export async function foldAST<T>(
  _prog: Program | Record<string, unknown>,
  _interp: Interpreter | Record<string, unknown>,
): Promise<T> {
  throw new Error(
    "foldAST is not available in the rebuilt core. " +
      "Migrate to fold(rootId, adj, interp) — see packages/core/src/fold.ts",
  );
}
