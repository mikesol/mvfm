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

import type { CExpr, RuntimeEntry } from "./expr";
import { makeCExpr } from "./expr";
import type { KindSpec, TraitKindSpec } from "./registry";

// ─── TraitDef: trait declaration with output type + mapping ────────

/** Declares a trait's output type and its type-to-kind mapping. */
export interface TraitDef<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

// ─── Scoped evaluation types ────────────────────────────────────────

/** Runtime binding for scoped lambda evaluation. */
export interface ScopedBinding {
  readonly paramId: string;
  readonly value: unknown;
}

/** Control effect: evaluate a child under temporary lexical bindings. */
export interface RecurseScopedEffect {
  readonly type: "recurse_scoped";
  readonly childId: string;
  readonly bindings: ScopedBinding[];
}

/** Values handlers can yield to the fold trampoline. */
export type FoldYield = number | string | RecurseScopedEffect;

// ─── Handler / Interpreter (canonical definition) ──────────────────

/** A handler yields child indices (number), node IDs (string), or scoped effects to the fold. */
export type Handler = (entry: RuntimeEntry) => AsyncGenerator<FoldYield, unknown, unknown>;

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
  readonly shapes?: Record<string, unknown>;
}

// ─── Type-level registry derivation ─────────────────────────────────

type MergeKinds<P extends readonly Plugin[]> = P extends readonly []
  ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["kinds"] & MergeKinds<T>
    : {};

type AllTraitNames<P extends readonly Plugin[]> = P extends readonly []
  ? never
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? keyof H["traits"] | AllTraitNames<T>
    : never;

type MergeTraitMappings<P extends readonly Plugin[], K extends string> = P extends readonly []
  ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? (K extends keyof H["traits"] ? H["traits"][K]["mapping"] : {}) & MergeTraitMappings<T, K>
    : {};

type TraitOutput<P extends readonly Plugin[], K extends string> = P extends readonly [
  infer H extends Plugin,
  ...infer T extends readonly Plugin[],
]
  ? K extends keyof H["traits"]
    ? H["traits"][K]["output"]
    : TraitOutput<T, K>
  : never;

type TraitEntries<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]: TraitKindSpec<TraitOutput<P, K>, MergeTraitMappings<P, K>>;
};

/** Derive a full registry from a plugin tuple. */
export type RegistryOf<P extends readonly Plugin[]> = MergeKinds<P> & TraitEntries<P>;

// ─── Runtime map builders ───────────────────────────────────────────

/** Build a lift map (TS type name to literal kind) from plugins. */
export function buildLiftMap(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) Object.assign(m, p.lifts);
  return m;
}

/** Build a trait map (trait name to type-to-kind mapping) from plugins. */
export function buildTraitMap(plugins: readonly Plugin[]): Record<string, Record<string, string>> {
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
export function buildKindInputs(plugins: readonly Plugin[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = ((spec as KindSpec<any, any>).inputs as unknown[]).map((v) => typeof v);
    }
  }
  return m;
}

/** Build a structural shapes map (kind to shape descriptor) from plugins. */
export function buildStructuralShapes(plugins: readonly Plugin[]): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (const p of plugins) {
    if (p.shapes) Object.assign(m, p.shapes);
  }
  return m;
}

// ─── mvfmU: compose plugins into $ ─────────────────────────────────

type MergeCtors<P extends readonly Plugin[]> = P extends readonly []
  ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["ctors"] & MergeCtors<T>
    : {};

type TraitCtors<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]: <A, B>(a: A, b: B) => CExpr<TraitOutput<P, K>, K, [A, B]>;
};

/** The composed constructor bag type: merged plugin ctors + auto-generated trait ctors. */
export type DollarSign<P extends readonly Plugin[]> = MergeCtors<P> & TraitCtors<P>;

/** Compose unified plugins into a constructor bag with auto-generated trait ctors. */
export function mvfmU<const P extends readonly Plugin[]>(...plugins: P): DollarSign<P> {
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
