import type { RuntimeEntry } from "./expr";

/** Runtime binding for scoped child evaluation. */
export interface ScopedBinding {
  paramId: string;
  value: unknown;
}

/** Control effect: evaluate child under temporary scoped bindings. */
export interface ScopedEffect {
  type: "recurse_scoped";
  child: number | string;
  bindings: ScopedBinding[];
}

/** Async-generator handler for one runtime node entry. */
export type Handler = (
  entry: RuntimeEntry,
) => AsyncGenerator<number | string | ScopedEffect, unknown, unknown>;

/** Interpreter map keyed by runtime node kind. */
export type Interpreter = Record<string, Handler>;

/** Minimal plugin shape required for defaults interpreter composition. */
export interface PluginDef {
  name: string;
  nodeKinds: readonly string[];
  defaultInterpreter?: () => Interpreter;
}

/** Node kinds that are never memoized in fold and always re-evaluated. */
export const VOLATILE_KINDS = new Set<string>(["core/lambda_param", "st/get"]);
