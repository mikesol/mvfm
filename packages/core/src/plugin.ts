/**
 * Plugin — unified plugin type with derived registries.
 *
 * Unifies PluginShape (ctors + kinds + traits) and interpreter into
 * a single Plugin type. Derives type-level registries AND runtime
 * maps from plugin tuples — no hardcoding needed.
 *
 * Exports:
 * - Plugin: unified type carrying type info + runtime interpreter
 * - RegistryOf<P>: type-level registry derived from a plugin tuple
 * - buildLiftMap/buildTraitMap/buildKindInputs: runtime map builders
 * - mvfmU: compose plugins into $ with auto-generated trait ctors
 */

import type { KindSpec, TraitKindSpec } from "./registry";
import type { CExpr, RuntimeEntry } from "./expr";
import { makeCExpr } from "./expr";
import { add, mul, sub, eq, numLit, strLit, boolLit } from "./constructors";

// ─── TraitDef: trait declaration with output type + mapping ────────

/** Declares a trait's output type and its type-to-kind mapping. */
export interface TraitDef<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

// ─── Handler / Interpreter (canonical definition) ──────────────────

/** A handler yields child indices (number) or node IDs (string) to resolve dependencies. */
export type Handler = (
  entry: RuntimeEntry,
) => AsyncGenerator<number | string, unknown, unknown>;

/** Maps node kind strings to their handlers. */
export type Interpreter = Record<string, Handler>;

// ─── Plugin: unified type info + runtime ───────────────────────────

/** Unified plugin type carrying constructors, kind specs, traits, lifts, and interpreter. */
export interface Plugin<
  Name extends string = string,
  Ctors extends Record<string, (...args: any[]) => any> = any,
  Kinds extends Record<string, KindSpec<any, any>> = any,
  Traits extends Record<string, TraitDef<any, any>> = any,
  Lifts extends Record<string, string> = any,
> {
  readonly name: Name;
  readonly ctors: Ctors;
  readonly kinds: Kinds;
  readonly traits: Traits;
  readonly lifts: Lifts;
  readonly nodeKinds: readonly string[];
  readonly defaultInterpreter?: () => Interpreter;
}

// ─── Type-level registry derivation ─────────────────────────────────

type MergeKinds<P extends readonly Plugin[]> =
  P extends readonly [] ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["kinds"] & MergeKinds<T>
    : {};

type AllTraitNames<P extends readonly Plugin[]> =
  P extends readonly [] ? never
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? keyof H["traits"] | AllTraitNames<T>
    : never;

type MergeTraitMappings<P extends readonly Plugin[], K extends string> =
  P extends readonly [] ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? (K extends keyof H["traits"] ? H["traits"][K]["mapping"] : {})
      & MergeTraitMappings<T, K>
    : {};

type TraitOutput<P extends readonly Plugin[], K extends string> =
  P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? K extends keyof H["traits"] ? H["traits"][K]["output"] : TraitOutput<T, K>
    : never;

type TraitEntries<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]: TraitKindSpec<
    TraitOutput<P, K>,
    MergeTraitMappings<P, K>
  >;
};

/** Derive a full registry from a plugin tuple. */
export type RegistryOf<P extends readonly Plugin[]> =
  MergeKinds<P> & TraitEntries<P>;

// ─── Runtime map builders ───────────────────────────────────────────

/** Build a lift map (TS type name to literal kind) from plugins. */
export function buildLiftMap(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) Object.assign(m, p.lifts);
  return m;
}

/** Build a trait map (trait name to type-to-kind mapping) from plugins. */
export function buildTraitMap(
  plugins: readonly Plugin[],
): Record<string, Record<string, string>> {
  const m: Record<string, Record<string, string>> = {};
  for (const p of plugins) {
    for (const [t, def] of Object.entries(p.traits)) {
      if (!m[t]) m[t] = {};
      Object.assign(m[t], (def as TraitDef<any, any>).mapping);
    }
  }
  return m;
}

/** Build a kind-inputs map (kind to array of input type names) from plugins. */
export function buildKindInputs(
  plugins: readonly Plugin[],
): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = ((spec as KindSpec<any, any>).inputs as unknown[]).map(v => typeof v);
    }
  }
  return m;
}

// ─── mvfmU: compose plugins into $ ─────────────────────────────────

type MergeCtors<P extends readonly Plugin[]> =
  P extends readonly [] ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["ctors"] & MergeCtors<T>
    : {};

type TraitCtors<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]:
    <A, B>(a: A, b: B) => CExpr<TraitOutput<P, K>, K, [A, B]>;
};

/** The composed constructor bag type: merged plugin ctors + auto-generated trait ctors. */
export type DollarSign<P extends readonly Plugin[]> = MergeCtors<P> & TraitCtors<P>;

/** Compose unified plugins into a constructor bag with auto-generated trait ctors. */
export function mvfmU<const P extends readonly Plugin[]>(
  ...plugins: P
): DollarSign<P> {
  const allCtors: Record<string, unknown> = {};
  const traitNames: Record<string, true> = {};
  for (const p of plugins) {
    Object.assign(allCtors, p.ctors);
    for (const name of Object.keys(p.traits)) traitNames[name] = true;
  }
  for (const name of Object.keys(traitNames)) {
    if (!(name in allCtors)) {
      allCtors[name] = <A, B>(a: A, b: B) => makeCExpr(name, [a, b]);
    }
  }
  return allCtors as DollarSign<P>;
}

// ─── Unified plugin definitions ─────────────────────────────────────

/** Unified numeric operations plugin with interpreter. */
export const numPluginU = {
  name: "num",
  ctors: { add, mul, sub, numLit },
  kinds: {
    "num/literal": { inputs: [], output: 0 as number } as KindSpec<[], number>,
    "num/add": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<[number, number], number>,
    "num/mul": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<[number, number], number>,
    "num/sub": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<[number, number], number>,
    "num/eq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<[number, number], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { number: "num/eq" } } as TraitDef<boolean, { number: "num/eq" }>,
  },
  lifts: { number: "num/literal" },
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub", "num/eq"],
  defaultInterpreter: (): Interpreter => ({
    "num/literal": async function* (e) { return e.out as number; },
    "num/add": async function* () { return ((yield 0) as number) + ((yield 1) as number); },
    "num/mul": async function* () { return ((yield 0) as number) * ((yield 1) as number); },
    "num/sub": async function* () { return ((yield 0) as number) - ((yield 1) as number); },
    "num/eq": async function* () { return ((yield 0) as number) === ((yield 1) as number); },
  }),
} as const;

/** Unified string operations plugin with interpreter. */
export const strPluginU = {
  name: "str",
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<[string, string], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { string: "str/eq" } } as TraitDef<boolean, { string: "str/eq" }>,
  },
  lifts: { string: "str/literal" },
  nodeKinds: ["str/literal", "str/eq"],
  defaultInterpreter: (): Interpreter => ({
    "str/literal": async function* (e) { return e.out as string; },
    "str/eq": async function* () { return ((yield 0) as string) === ((yield 1) as string); },
  }),
} as const;

/** Unified boolean operations plugin with interpreter. */
export const boolPluginU = {
  name: "bool",
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": { inputs: [false, false] as [boolean, boolean], output: false as boolean } as KindSpec<[boolean, boolean], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { boolean: "bool/eq" } } as TraitDef<boolean, { boolean: "bool/eq" }>,
  },
  lifts: { boolean: "bool/literal" },
  nodeKinds: ["bool/literal", "bool/eq"],
  defaultInterpreter: (): Interpreter => ({
    "bool/literal": async function* (e) { return e.out as boolean; },
    "bool/eq": async function* () { return ((yield 0) as boolean) === ((yield 1) as boolean); },
  }),
} as const;

/** Standard plugin tuple: num + str + bool. */
export const stdPlugins = [numPluginU, strPluginU, boolPluginU] as const;

// ─── Ord plugin: proves extensibility ──────────────────────────────

/** Create a less-than comparison expression (trait-dispatched). */
export function lt<A, B>(a: A, b: B): CExpr<boolean, "lt", [A, B]> {
  return makeCExpr("lt", [a, b]);
}

/** Ordering plugin with lt trait for numbers and strings. */
export const ordPlugin = {
  name: "ord",
  ctors: { lt },
  kinds: {
    "num/lt": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<[number, number], boolean>,
    "str/lt": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<[string, string], boolean>,
  },
  traits: {
    lt: { output: false as boolean, mapping: { number: "num/lt", string: "str/lt" } } as TraitDef<boolean, { number: "num/lt"; string: "str/lt" }>,
  },
  lifts: {},
  nodeKinds: ["num/lt", "str/lt"],
  defaultInterpreter: (): Interpreter => ({
    "num/lt": async function* () { return ((yield 0) as number) < ((yield 1) as number); },
    "str/lt": async function* () { return ((yield 0) as string) < ((yield 1) as string); },
  }),
} as const;
