/**
 * Koan 03a: Composition — unified plugins with derived registries
 *
 * Unifies PluginShape (ctors + kinds + traits) and PluginDef (name +
 * interpreter) into a single Plugin type. Derives the type-level
 * registry AND runtime maps from the plugin tuple — no hardcoding.
 *
 * This koan exports the canonical composition machinery:
 * - Plugin: unified type carrying type info + runtime interpreter
 * - RegistryOf<P>: type-level registry derived from a plugin tuple
 * - buildLiftMap/buildTraitMap/buildKindInputs: runtime map builders
 * - mvfmU: compose plugins into $ with auto-generated trait ctors
 *
 * Proves extensibility: adding ordPlugin (lt, gt) extends everything
 * without modifying existing plugins or code.
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/03a-composition.ts
 *   npx tsx spike-koans/03a-composition.ts
 */

export * from "./03-traits";

import type {
  CExpr, COutOf, CKindOf,
  KindSpec, TraitKindSpec, RuntimeEntry,
  StdRegistry,
} from "./03-traits";
import { makeCExpr, add, mul, sub, eq, numLit, strLit, boolLit } from "./03-traits";

// ─── TraitDef: trait declaration with output type + mapping ────────
export interface TraitDef<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

// ─── Handler / Interpreter (canonical definition) ──────────────────
// Yield number = positional child index. Yield string = direct node ID.
export type Handler = (
  entry: RuntimeEntry,
) => AsyncGenerator<number | string, unknown, unknown>;

export type Interpreter = Record<string, Handler>;

// ─── Plugin: unified type info + runtime ───────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL REGISTRY DERIVATION
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME MAP BUILDERS
// ═══════════════════════════════════════════════════════════════════════

export function buildLiftMap(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) Object.assign(m, p.lifts);
  return m;
}

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

// ═══════════════════════════════════════════════════════════════════════
// MVFM: COMPOSE PLUGINS INTO $
// ═══════════════════════════════════════════════════════════════════════

type MergeCtors<P extends readonly Plugin[]> =
  P extends readonly [] ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["ctors"] & MergeCtors<T>
    : {};

type TraitCtors<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]:
    <A, B>(a: A, b: B) => CExpr<TraitOutput<P, K>, K, [A, B]>;
};

export type DollarSign<P extends readonly Plugin[]> = MergeCtors<P> & TraitCtors<P>;

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

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED PLUGIN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

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

export const stdPlugins = [numPluginU, strPluginU, boolPluginU] as const;

// ─── Ord plugin: proves extensibility ──────────────────────────────
export function lt<A, B>(a: A, b: B): CExpr<boolean, "lt", [A, B]> {
  return makeCExpr("lt", [a, b]);
}

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

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// --- Derived registry matches hardcoded StdRegistry ---
type DerivedReg = RegistryOf<typeof stdPlugins>;

const _drNumAdd: DerivedReg["num/add"] extends KindSpec<[number, number], number> ? true : never = true;
const _drStrEq: DerivedReg["str/eq"] extends KindSpec<[string, string], boolean> ? true : never = true;
const _drBoolLit: DerivedReg["bool/literal"] extends KindSpec<[], boolean> ? true : never = true;
const _drEq: DerivedReg["eq"] extends TraitKindSpec<boolean, {
  number: "num/eq"; string: "str/eq"; boolean: "bool/eq";
}> ? true : never = true;

// Bidirectional assignability with StdRegistry
const _fwd: DerivedReg extends StdRegistry ? true : never = true;
const _bwd: StdRegistry extends DerivedReg ? true : never = true;

// --- Extended registry includes ord ---
type ExtPlugins = [...typeof stdPlugins, typeof ordPlugin];
type ExtReg = RegistryOf<ExtPlugins>;

const _extNumLt: ExtReg["num/lt"] extends KindSpec<[number, number], boolean> ? true : never = true;
const _extLt: ExtReg["lt"] extends TraitKindSpec<boolean, {
  number: "num/lt"; string: "str/lt";
}> ? true : never = true;
// Old entries unchanged
const _extEq: ExtReg["eq"] extends TraitKindSpec<boolean, {
  number: "num/eq"; string: "str/eq"; boolean: "bool/eq";
}> ? true : never = true;

// --- mvfmU $ has correct ctors + auto-generated trait ctors ---
const $std = mvfmU(...stdPlugins);
const _mAdd = $std.add(1, 2);
const _mAddK: CKindOf<typeof _mAdd> = "num/add";
const _mEq = $std.eq(3, 4);
const _mEqK: CKindOf<typeof _mEq> = "eq";
const _mEqO: COutOf<typeof _mEq> = true;

// Extended $ has lt auto-generated
const $ext = mvfmU(...stdPlugins, ordPlugin);
const _mLt = $ext.lt(3, 4);
const _mLtK: CKindOf<typeof _mLt> = "lt";
const _mLtO: COutOf<typeof _mLt> = true;
const _mEqExt = $ext.eq("a", "b");
const _mEqExtK: CKindOf<typeof _mEqExt> = "eq";

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error(`  FAIL: ${msg}`); }
}

// --- buildLiftMap ---
const lm = buildLiftMap(stdPlugins);
assert(lm.number === "num/literal", "lift: number");
assert(lm.string === "str/literal", "lift: string");
assert(lm.boolean === "bool/literal", "lift: boolean");
assert(Object.keys(lm).length === 3, "lift: 3 entries");

// --- buildTraitMap ---
const tm = buildTraitMap(stdPlugins);
assert(tm.eq.number === "num/eq", "trait: eq/number");
assert(tm.eq.string === "str/eq", "trait: eq/string");
assert(tm.eq.boolean === "bool/eq", "trait: eq/boolean");

// --- buildKindInputs ---
const ki = buildKindInputs(stdPlugins);
assert(JSON.stringify(ki["num/add"]) === '["number","number"]', "ki: num/add");
assert(JSON.stringify(ki["str/eq"]) === '["string","string"]', "ki: str/eq");
assert(JSON.stringify(ki["num/literal"]) === '[]', "ki: num/literal (no inputs)");

// --- Extended: ord plugin extends everything automatically ---
const extPlugins = [...stdPlugins, ordPlugin] as const;
const tmExt = buildTraitMap(extPlugins);
assert(tmExt.lt.number === "num/lt", "ext trait: lt/number");
assert(tmExt.lt.string === "str/lt", "ext trait: lt/string");
assert(tmExt.eq.number === "num/eq", "ext trait: eq unchanged");
const kiExt = buildKindInputs(extPlugins);
assert(JSON.stringify(kiExt["num/lt"]) === '["number","number"]', "ext ki: num/lt");

// --- mvfmU runtime ---
assert($std.add(1, 2).__kind === "num/add", "mvfm: add works");
assert($std.eq(3, 4).__kind === "eq", "mvfm: eq works");
assert($ext.lt(3, 4).__kind === "lt", "mvfm: lt works (extended)");
assert($ext.eq(3, 4).__kind === "eq", "mvfm: eq still works (extended)");

// --- Multi-type simultaneous: prevents "just implement num" shortcut ---
const $all = mvfmU(...stdPlugins);
assert($all.add(1, 2).__kind === "num/add", "multi: num/add");
assert($all.strLit("hi") === "hi", "multi: strLit is passthrough");
assert($all.eq(1, 2).__kind === "eq", "multi: eq(num)");
assert($all.eq("a", "b").__kind === "eq", "multi: eq(str)");
assert($all.eq(true, false).__kind === "eq", "multi: eq(bool)");

console.log(`\n03a-composition: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
