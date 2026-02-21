/**
 * Registry — type-level registry for node kinds and trait dispatch.
 *
 * KindSpec describes a node's input/output signature.
 * TraitKindSpec describes a polymorphic trait dispatched by TypeKey.
 * StdRegistry is the built-in registry for the standard prelude.
 */

// ─── KindSpec: input/output signature for a concrete node kind ──────

/** Describes a concrete node kind's input types and output type. */
export interface KindSpec<I extends readonly unknown[], O> {
  readonly inputs: I;
  readonly output: O;
}

// ─── TraitKindSpec: polymorphic trait dispatched by type key ─────────

/** Describes a trait node kind that dispatches to concrete kinds based on type. */
export interface TraitKindSpec<O, Mapping extends Record<string, string>> {
  readonly trait: true;
  readonly output: O;
  readonly mapping: Mapping;
}

// ─── RegistryEntry: union of all registry entry shapes ──────────────

/** A registry entry is either a concrete KindSpec or a polymorphic TraitKindSpec. */
export type RegistryEntry = KindSpec<any, any> | TraitKindSpec<any, any>;

// ─── LiftKind: maps a literal TS type to its literal node kind ──────

/** Maps a TypeScript primitive type to the corresponding literal node kind string. */
export type LiftKind<T> = T extends number
  ? "num/literal"
  : T extends string
    ? "str/literal"
    : T extends boolean
      ? "bool/literal"
      : never;

// ─── TypeKey: maps a TS type to its string key for trait dispatch ────

/** Maps a TypeScript primitive type to the string key used in trait dispatch mappings. */
export type TypeKey<T> = T extends number
  ? "number"
  : T extends string
    ? "string"
    : T extends boolean
      ? "boolean"
      : never;

// ─── StdRegistry: built-in registry for the standard prelude ────────

/** The standard registry mapping node kind strings to their KindSpec or TraitKindSpec. */
export type StdRegistry = {
  "num/literal": KindSpec<[], number>;
  "num/add": KindSpec<[number, number], number>;
  "num/mul": KindSpec<[number, number], number>;
  "num/sub": KindSpec<[number, number], number>;
  "str/literal": KindSpec<[], string>;
  "bool/literal": KindSpec<[], boolean>;
  "num/eq": KindSpec<[number, number], boolean>;
  "str/eq": KindSpec<[string, string], boolean>;
  "bool/eq": KindSpec<[boolean, boolean], boolean>;
  eq: TraitKindSpec<
    boolean,
    {
      number: "num/eq";
      string: "str/eq";
      boolean: "bool/eq";
    }
  >;
};
