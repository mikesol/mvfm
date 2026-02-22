/**
 * Compatibility shims for external plugins still using the pre-koan API.
 *
 * Kept for: plugin-zod, plugin-openai, plugin-anthropic.
 * These will be removed once those plugins are migrated to the new API.
 *
 * @deprecated Prefer the new API: mvfm, fold, defaults, Plugin, Interpreter.
 */

import { fold } from "./api";
import type { Interpreter } from "./plugin";

// ─── TypedNode: old interpreter node type ────────────────────────────

/** @deprecated Old-API node interface. Migrate to RuntimeEntry-based handlers. */
export interface TypedNode<T = unknown> {
  readonly kind: string;
  readonly args?: TypedNode[];
  readonly __T?: T;
  readonly [key: string]: unknown;
}

// ─── NodeTypeMap: declaration merging target ─────────────────────────

/** @deprecated Registry for typed node declarations via module augmentation. */
export interface NodeTypeMap {}

// ─── Expr: old phantom-typed expression wrapper ─────────────────────

/** @deprecated Old-API expression base with phantom type and AST node. */
export interface ExprBase<T> {
  readonly __type: T;
  readonly __node: TypedNode<T>;
  readonly [key: string]: unknown;
}

/** @deprecated Old-API expression type. Migrate to CExpr. */
export type Expr<T = unknown> = ExprBase<T>;

// ─── PluginContext: old plugin build context ─────────────────────────

/** @deprecated Old-API context passed to plugin build(). Migrate to Plugin interface. */
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

/** @deprecated Old-API plugin factory. Returns the definition as-is. */
export function definePlugin<T extends { name: string; nodeKinds: string[] }>(def: T): T {
  return def;
}

// ─── defineInterpreter: old curried interpreter factory ──────────────

type IsAny<T> = 0 extends 1 & T ? true : false;
type ExtractNodeParam<F> = F extends (node: infer N, ...args: unknown[]) => unknown ? N : unknown;
type RejectAnyParam<_K extends string, H> = IsAny<ExtractNodeParam<H>> extends true ? never : H;

type Handler<N extends TypedNode<unknown>> =
  N extends TypedNode<infer T> ? (node: N) => AsyncGenerator<unknown, T, unknown> : never;

type InterpreterHandlers<K extends string> = string extends K
  ? Record<string, (node: any) => AsyncGenerator<unknown, unknown, unknown>>
  : {
      [P in K]: P extends keyof NodeTypeMap ? Handler<NodeTypeMap[P] & TypedNode<unknown>> : never;
    };

/** @deprecated Old-API curried interpreter factory. Migrate to Interpreter type. */
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

/** @deprecated Old-API helper to evaluate a child node by yielding it to the fold. */
export async function* eval_<T>(node: TypedNode<T>): AsyncGenerator<TypedNode, T, unknown> {
  return (yield node) as T;
}

// ─── foldAST: compatibility wrapper over fold ───────────────────────

/**
 * Compatibility wrapper that delegates to the new fold(interp, prog) API.
 *
 * @deprecated Use fold(interp, prog) directly.
 */
export async function foldAST<T>(
  interpOrProg: Interpreter | Record<string, unknown>,
  progOrInterp: unknown,
): Promise<T> {
  return (await fold(interpOrProg as any, progOrInterp as any)) as T;
}
