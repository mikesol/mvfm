import {
  add,
  boolLit,
  type CExpr,
  eq,
  type KindSpec,
  makeCExpr,
  mul,
  numLit,
  type RuntimeEntry,
  type StdRegistry,
  strLit,
  sub,
  type TraitKindSpec,
} from "./expr";

/** Trait declaration shape used by unified plugins. */
export interface TraitDef<O, Mapping extends Record<string, string>> {
  readonly output: O;
  readonly mapping: Mapping;
}

/** Koan handler protocol. */
export type Handler = (entry: RuntimeEntry) => AsyncGenerator<number | string, unknown, unknown>;

/** Koan interpreter map. */
export type Interpreter = Record<string, Handler>;

/** 03-traits compatibility plugin shape. */
export interface PluginShape<
  Ctors extends Record<string, unknown>,
  Kinds extends Record<string, KindSpec<readonly unknown[], unknown>>,
  Traits extends Record<string, Record<string, string>>,
> {
  readonly ctors: Ctors;
  readonly kinds: Kinds;
  readonly traits: Traits;
}

/** Unified koan plugin definition. */
export interface Plugin<
  Name extends string = string,
  Ctors extends Record<string, unknown> = Record<string, unknown>,
  Kinds extends Record<string, KindSpec<readonly unknown[], unknown>> = Record<
    string,
    KindSpec<readonly unknown[], unknown>
  >,
  Traits extends Record<string, TraitDef<unknown, Record<string, string>>> = Record<
    string,
    TraitDef<unknown, Record<string, string>>
  >,
  Lifts extends Record<string, string> = Record<string, string>,
> {
  readonly name: Name;
  readonly ctors: Ctors;
  readonly kinds: Kinds;
  readonly traits: Traits;
  readonly lifts: Lifts;
  readonly nodeKinds: readonly string[];
  readonly defaultInterpreter?: () => Interpreter;
}

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

/** 03a canonical type-level registry derivation. */
export type RegistryOf<P extends readonly Plugin[]> = MergeKinds<P> & TraitEntries<P>;

/** Build literal lift map from plugin tuple. */
export function buildLiftMap(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) {
    Object.assign(m, p.lifts);
  }
  return m;
}

/** Build trait map from plugin tuple. */
export function buildTraitMap(plugins: readonly Plugin[]): Record<string, Record<string, string>> {
  const m: Record<string, Record<string, string>> = {};
  for (const p of plugins) {
    for (const [traitName, traitDef] of Object.entries(p.traits)) {
      if (!(traitName in m)) {
        m[traitName] = {};
      }
      Object.assign(m[traitName], traitDef.mapping);
    }
  }
  return m;
}

/** Build kind input type names from plugin tuple. */
export function buildKindInputs(plugins: readonly Plugin[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = spec.inputs.map((v) => typeof v);
    }
  }
  return m;
}

type MergeCtors<P extends readonly Plugin[]> = P extends readonly []
  ? {}
  : P extends readonly [infer H extends Plugin, ...infer T extends readonly Plugin[]]
    ? H["ctors"] & MergeCtors<T>
    : {};

type TraitCtors<P extends readonly Plugin[]> = {
  [K in AllTraitNames<P> & string]: <A, B>(a: A, b: B) => CExpr<TraitOutput<P, K>, K, [A, B]>;
};

/** Unified koan constructor surface. */
export type DollarSign<P extends readonly Plugin[]> = MergeCtors<P> & TraitCtors<P>;

/** Compose unified plugins into a constructor surface with auto-generated trait ctors. */
export function mvfmU<const P extends readonly Plugin[]>(...plugins: P): DollarSign<P> {
  const allCtors: Record<string, unknown> = {};
  const traitNames = new Set<string>();
  for (const p of plugins) {
    Object.assign(allCtors, p.ctors);
    for (const t of Object.keys(p.traits)) {
      traitNames.add(t);
    }
  }
  for (const t of traitNames) {
    if (!(t in allCtors)) {
      allCtors[t] = <A, B>(a: A, b: B): CExpr<boolean, string, [A, B]> => makeCExpr(t, [a, b]);
    }
  }
  return allCtors as DollarSign<P>;
}

/** Trait-level less-than constructor. */
export function lt<A, B>(a: A, b: B): CExpr<boolean, "lt", [A, B]> {
  return makeCExpr("lt", [a, b]);
}

/** Unified number plugin. */
export const numPluginU = {
  name: "num",
  ctors: { add, mul, sub, numLit },
  kinds: {
    "num/literal": { inputs: [], output: 0 as number } as KindSpec<[], number>,
    "num/add": { inputs: [0, 0], output: 0 as number } as KindSpec<[number, number], number>,
    "num/mul": { inputs: [0, 0], output: 0 as number } as KindSpec<[number, number], number>,
    "num/sub": { inputs: [0, 0], output: 0 as number } as KindSpec<[number, number], number>,
    "num/eq": { inputs: [0, 0], output: false as boolean } as KindSpec<[number, number], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { number: "num/eq" } },
  },
  lifts: { number: "num/literal" },
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub", "num/eq"],
  defaultInterpreter: (): Interpreter => ({
    "num/literal": async function* (e) {
      yield* [];
      return e.out as number;
    },
    "num/add": async function* () {
      return ((yield 0) as number) + ((yield 1) as number);
    },
    "num/mul": async function* () {
      return ((yield 0) as number) * ((yield 1) as number);
    },
    "num/sub": async function* () {
      return ((yield 0) as number) - ((yield 1) as number);
    },
    "num/eq": async function* () {
      return ((yield 0) as number) === ((yield 1) as number);
    },
  }),
} as const satisfies Plugin;

/** Unified string plugin. */
export const strPluginU = {
  name: "str",
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": { inputs: ["", ""], output: false as boolean } as KindSpec<[string, string], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { string: "str/eq" } },
  },
  lifts: { string: "str/literal" },
  nodeKinds: ["str/literal", "str/eq"],
  defaultInterpreter: (): Interpreter => ({
    "str/literal": async function* (e) {
      yield* [];
      return e.out as string;
    },
    "str/eq": async function* () {
      return ((yield 0) as string) === ((yield 1) as string);
    },
  }),
} as const satisfies Plugin;

/** Unified boolean plugin. */
export const boolPluginU = {
  name: "bool",
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": { inputs: [false, false], output: false as boolean } as KindSpec<
      [boolean, boolean],
      boolean
    >,
  },
  traits: {
    eq: { output: false as boolean, mapping: { boolean: "bool/eq" } },
  },
  lifts: { boolean: "bool/literal" },
  nodeKinds: ["bool/literal", "bool/eq"],
  defaultInterpreter: (): Interpreter => ({
    "bool/literal": async function* (e) {
      yield* [];
      return e.out as boolean;
    },
    "bool/eq": async function* () {
      return ((yield 0) as boolean) === ((yield 1) as boolean);
    },
  }),
} as const satisfies Plugin;

/** Canonical std plugin tuple for koan 03a. */
export const stdPlugins = [numPluginU, strPluginU, boolPluginU] as const;

/** Unified ord plugin proving extensibility. */
export const ordPlugin = {
  name: "ord",
  ctors: { lt },
  kinds: {
    "num/lt": { inputs: [0, 0], output: false as boolean } as KindSpec<[number, number], boolean>,
    "str/lt": { inputs: ["", ""], output: false as boolean } as KindSpec<[string, string], boolean>,
  },
  traits: {
    lt: { output: false as boolean, mapping: { number: "num/lt", string: "str/lt" } },
  },
  lifts: {},
  nodeKinds: ["num/lt", "str/lt"],
  defaultInterpreter: (): Interpreter => ({
    "num/lt": async function* () {
      return ((yield 0) as number) < ((yield 1) as number);
    },
    "str/lt": async function* () {
      return ((yield 0) as string) < ((yield 1) as string);
    },
  }),
} as const satisfies Plugin;

export type KoanStdRegistry = StdRegistry;
export { add, boolLit, eq, makeCExpr, mul, numLit, strLit, sub };
