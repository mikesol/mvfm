/**
 * Front-door API — mvfm, fold, defaults, injectInput, prelude.
 *
 * Thin wrapper over the internal engine (elaborate, fold, plugin).
 * Provides the ergonomic builder pattern used by consumers.
 */

import { corePlugin } from "./core-plugin";
import { createApp } from "./elaborate";
import type { CExpr, NExpr, RuntimeEntry } from "./expr";
import { isCExpr, makeCExpr, makeNExpr } from "./expr";
import type { FoldState } from "./fold";
import { defaults as internalDefaults, fold as internalFold } from "./fold";
import type { DollarSign, Interpreter, Plugin } from "./plugin";
import { composeDollar } from "./plugin";
import type { RecordingStack } from "./recording";
import { runBlock } from "./recording";
import type { SchemaToData } from "./schema-types";
import { boolPlugin, numPlugin, ordPlugin, strPlugin } from "./std-plugins";

export { coreInterpreter, corePlugin } from "./core-plugin";

// ─── Cell counter for unique IDs ────────────────────────────────────

let _cellCounter = 0;

// ─── Type utilities ─────────────────────────────────────────────────

/** Flatten a single plugin input: unwrap arrays recursively, wrap single plugins. */
type FlattenPluginInput<P> = P extends readonly unknown[] ? FlattenPluginInputs<P> : [P];

/** Recursively flatten a tuple of plugin inputs into a flat plugin tuple. */
type FlattenPluginInputs<P extends readonly unknown[]> = P extends readonly [infer H, ...infer T]
  ? [...FlattenPluginInput<H>, ...FlattenPluginInputs<T>]
  : [];

/** Valid plugin input: a single plugin or a readonly array of plugins (possibly nested). */
type PluginInput = Plugin | readonly PluginInput[];

// ─── CoreDollar types ───────────────────────────────────────────────

/** State cell returned by $.let() in the mvfm() API. */
export interface StateCell {
  get(): CExpr<unknown>;
  set(val: unknown): CExpr<unknown>;
  push(val: unknown): CExpr<unknown>;
}

/** Core methods added by mvfm() on top of plugin constructors. */
export interface CoreDollar<S extends Record<string, string> = Record<string, string>> {
  input: CExpr<SchemaToData<S>>;
  begin(...exprs: unknown[]): CExpr<unknown>;
  show(a: unknown): CExpr<string>;
  cond(pred: unknown): {
    t(then: unknown): { f(els: unknown): CExpr<unknown> };
    f(els: unknown): { t(then: unknown): CExpr<unknown> };
  };
  let(initial: unknown): StateCell;
  each(items: unknown[], cb: (item: unknown) => unknown): CExpr<unknown>;
  while(cond: unknown): { body(fn: () => unknown): CExpr<unknown> };
}

/** Full $ type: plugin constructors merged + core extensions overriding specific keys. */
export type MvfmDollar<
  P extends readonly PluginInput[],
  S extends Record<string, string> = Record<string, string>,
> = Omit<
  DollarSign<[typeof corePlugin, ...FlattenPluginInputs<P>]>,
  keyof CoreDollar
> &
  CoreDollar<S>;

// ─── prelude ────────────────────────────────────────────────────────

/** Standard prelude plugins: num, str, bool, ord. */
export const prelude = [numPlugin, strPlugin, boolPlugin, ordPlugin] as const;

// ─── Program type ───────────────────────────────────────────────────

/** A compiled program with NExpr, plugin list, and optional input schema. */
export interface Program<S extends Record<string, string> | undefined = undefined> {
  readonly __nexpr: NExpr<unknown, string, unknown, string>;
  readonly __plugins: readonly Plugin[];
  readonly __inputSchema?: S extends undefined ? Record<string, string> : S;
}

// ─── Helper: deep auto-lift ─────────────────────────────────────────

function deepAutoLift(value: unknown): unknown {
  if (isCExpr(value)) return value;
  if (Array.isArray(value)) {
    return makeCExpr("core/tuple", [value.map(deepAutoLift)]);
  }
  if (typeof value === "object" && value !== null) {
    const lifted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      lifted[k] = deepAutoLift(v);
    }
    return makeCExpr("core/record", [lifted]);
  }
  return value; // primitive — elaborate will auto-lift
}

// ─── mvfm ───────────────────────────────────────────────────────────

/** Create an app builder from plugins. Returns a function that takes a schema and builder. */
export function mvfm<const P extends readonly PluginInput[]>(...pluginInputs: P) {
  const plugins: Plugin[] = [corePlugin];
  for (const p of pluginInputs) {
    if (Array.isArray(p)) plugins.push(...(p as Plugin[]));
    else plugins.push(p as Plugin);
  }

  function define(fn: ($: MvfmDollar<P>) => unknown): Program<undefined>;
  function define<const S extends Record<string, string>>(
    schema: S,
    fn: ($: MvfmDollar<P, S>) => unknown,
  ): Program<S>;
  function define(
    schemaOrFn: Record<string, string> | (($: MvfmDollar<P>) => unknown),
    maybeFn?: ($: MvfmDollar<P>) => unknown,
  ): Program<any> {
    const schema = typeof schemaOrFn === "function" ? undefined : schemaOrFn;
    const fn = typeof schemaOrFn === "function" ? schemaOrFn : maybeFn!;

    const effects: unknown[] = [];
    const recording: RecordingStack = [];
    const pluginDollar = composeDollar(...plugins);

    // Build $ with core extensions. Runtime uses Record<string, unknown> internally;
    // the public type exposed to the callback is MvfmDollar<P>.
    const dollar: Record<string, unknown> = {
      ...pluginDollar,
      input: makeCExpr("core/input", []),
      begin: (...exprs: unknown[]) => makeCExpr("core/begin", exprs),
      show: (a: unknown) => makeCExpr("show", [a, a]),
      cond: (pred: unknown) => {
        const mkCond = (p: unknown, t: unknown, e: unknown) => {
          const c = makeCExpr("core/cond", [p, t, e]);
          if (recording.length > 0) {
            recording[recording.length - 1].push(c);
          }
          return c;
        };
        return {
          t: (then: unknown) => ({
            f: (els: unknown) => mkCond(pred, then, els),
          }),
          f: (els: unknown) => ({
            t: (then: unknown) => mkCond(pred, then, els),
          }),
        };
      },
    };

    // Override st.let to auto-lift initial, push let-init to effects, record set/push
    if (dollar.let) {
      dollar.let = (initial: unknown) => {
        const lifted = deepAutoLift(initial);
        const cellId = `__cell_${_cellCounter++}`;
        const letExpr = makeCExpr("st/let", [lifted, cellId]);
        effects.push(letExpr);

        return {
          get: () => makeCExpr("st/get", [cellId]),
          set: (val: unknown) => {
            const expr = makeCExpr("st/set", [cellId, val]);
            if (recording.length > 0) {
              recording[recording.length - 1].push(expr);
            } else {
              effects.push(expr);
            }
            return expr;
          },
          push: (val: unknown) => {
            const expr = makeCExpr("st/push", [cellId, val]);
            if (recording.length > 0) {
              recording[recording.length - 1].push(expr);
            } else {
              effects.push(expr);
            }
            return expr;
          },
        };
      };
    }

    // each: unroll + imperative effect
    dollar.each = (items: unknown[], cb: (item: unknown) => unknown) => {
      const results = items.map((item: unknown) => runBlock(recording, cb, [item]));
      const expr = makeCExpr("core/begin", results);
      effects.push(expr);
      return expr;
    };

    // while: imperative effect
    dollar.while = (cond: unknown) => ({
      body: (bodyFn: () => unknown) => {
        const body = runBlock(recording, bodyFn, []);
        const whileExpr = makeCExpr("control/while", [cond, body]);
        effects.push(whileExpr);
        return whileExpr;
      },
    });

    const $ = dollar as MvfmDollar<P>;

    let result: unknown = fn($);
    result = deepAutoLift(result);

    // Wrap result with collected imperative effects
    if (effects.length > 0) {
      result = makeCExpr("core/begin", [...effects, result]);
    }

    const nexpr = createApp(...plugins)(result as CExpr<unknown>);
    return { __nexpr: nexpr, __plugins: plugins, __inputSchema: schema };
  }

  return Object.assign(define, { plugins });
}

// ─── injectInput ────────────────────────────────────────────────────

/** Inject input data into a compiled program, replacing core/input node outputs. */
export function injectInput<S extends Record<string, string> | undefined>(
  prog: Program<S>,
  data: S extends Record<string, string> ? SchemaToData<S> : Record<string, unknown>,
): Program<S>;
export function injectInput(prog: Program<any>, data: Record<string, unknown>): Program<any> {
  const oldAdj = prog.__nexpr.__adj;
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(oldAdj)) {
    if (entry.kind === "core/input") {
      newAdj[id] = { ...entry, out: data };
    } else {
      newAdj[id] = entry;
    }
  }
  return {
    ...prog,
    __nexpr: makeNExpr(prog.__nexpr.__id, newAdj, prog.__nexpr.__counter),
  };
}

// ─── Public defaults ────────────────────────────────────────────────

/** Build a merged interpreter from plugins or an app object, with optional overrides. */
export function defaults(
  appOrPlugins: readonly Plugin[] | { plugins?: readonly Plugin[]; __plugins?: readonly Plugin[] },
  overrides?: Record<string, Interpreter>,
): Interpreter {
  if (Array.isArray(appOrPlugins)) {
    return internalDefaults(appOrPlugins as Plugin[], overrides);
  }
  const plugins =
    (appOrPlugins as { plugins?: readonly Plugin[]; __plugins?: readonly Plugin[] }).plugins ??
    (appOrPlugins as { __plugins?: readonly Plugin[] }).__plugins ??
    [];
  return internalDefaults(plugins as Plugin[], overrides);
}

// ─── Public fold ────────────────────────────────────────────────────

/** Evaluate a program/NExpr. Supports fold(interp, prog), fold(nexpr, interp), and fold(rootId, adj, interp). */
export async function fold(interp: Interpreter, prog: Program<any>): Promise<unknown>;
export async function fold(
  nexpr: NExpr<unknown, string, unknown, string>,
  interp: Interpreter,
  state?: FoldState,
): Promise<unknown>;
export async function fold(
  rootId: string,
  adj: Record<string, RuntimeEntry>,
  interp: Interpreter,
  state?: FoldState,
): Promise<unknown>;
export async function fold(
  first: unknown,
  second: unknown,
  third?: unknown,
  fourth?: unknown,
): Promise<unknown> {
  if (typeof first === "string") {
    return internalFold(
      first,
      second as Record<string, RuntimeEntry>,
      third as Interpreter,
      fourth as FoldState | undefined,
    );
  }
  if (first && typeof first === "object" && "__id" in first) {
    return internalFold(
      first as NExpr<unknown, string, unknown, string>,
      second as Interpreter,
      third as FoldState | undefined,
    );
  }
  return internalFold((second as Program).__nexpr, first as Interpreter);
}
