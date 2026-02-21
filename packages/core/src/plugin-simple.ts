/**
 * Plugin composition (simple) -- PluginShape, basic plugins, mvfm.
 *
 * PluginShape captures what a plugin provides: constructors, kind specs,
 * and trait instance mappings. mvfm() merges plugin constructors and
 * adds the eq trait constructor.
 */

import { add, boolLit, eq, mul, numLit, strLit } from "./constructors";
import type { KindSpec } from "./registry";

// ─── PluginShape: what a plugin provides ────────────────────────────

/** Shape of a simple plugin: constructors, kind specs, and trait mappings. */
export interface PluginShape<
  Ctors extends Record<string, (...args: any[]) => any>,
  Kinds extends Record<string, KindSpec<any, any>>,
  Traits extends Record<string, Record<string, string>>,
> {
  readonly ctors: Ctors;
  readonly kinds: Kinds;
  readonly traits: Traits;
}

// ─── Plugin definitions ─────────────────────────────────────────────

/** Standard numeric operations plugin (simple form). */
export const numPlugin = {
  ctors: { add, mul, numLit },
  kinds: {
    "num/literal": { inputs: [], output: 0 as number } as KindSpec<[], number>,
    "num/add": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/mul": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/eq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
  },
  traits: {
    eq: { number: "num/eq" },
  },
} as const;

/** Standard string operations plugin (simple form). */
export const strPlugin = {
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
  },
  traits: {
    eq: { string: "str/eq" },
  },
} as const;

/** Standard boolean operations plugin (simple form). */
export const boolPlugin = {
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
  },
  traits: {
    eq: { boolean: "bool/eq" },
  },
} as const;

// ─── mvfm: compose plugins ─────────────────────────────────────────

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never;

type MergeCtors<Plugins extends readonly PluginShape<any, any, any>[]> = UnionToIntersection<
  Plugins[number]["ctors"]
>;

type SimpleDollarSign<Plugins extends readonly PluginShape<any, any, any>[]> =
  MergeCtors<Plugins> & { eq: typeof eq };

/** Compose simple plugins into a unified constructor bag with eq. */
export function mvfm<const P extends readonly PluginShape<any, any, any>[]>(
  ...plugins: P
): SimpleDollarSign<P> {
  const allCtors: Record<string, unknown> = {};
  for (const plugin of plugins) {
    Object.assign(allCtors, plugin.ctors);
  }
  return { ...allCtors, eq } as SimpleDollarSign<P>;
}
