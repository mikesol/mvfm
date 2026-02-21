/**
 * Standard plugin definitions — num, str, bool, ord.
 *
 * These are the built-in unified plugins with interpreters.
 * Split from plugin.ts to stay under 300-line limit.
 */

import { add, boolLit, mul, numLit, strLit, sub } from "./constructors";
import type { CExpr } from "./expr";
import { makeCExpr } from "./expr";
import type { Interpreter, TraitDef } from "./plugin";
import type { KindSpec } from "./registry";

// ─── Unified plugin definitions ─────────────────────────────────────

/** Unified numeric operations plugin with interpreter. */
export const numPluginU = {
  name: "num",
  ctors: { add, mul, sub, numLit },
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
    "num/sub": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/eq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
  },
  traits: {
    eq: { output: false as boolean, mapping: { number: "num/eq" } } as TraitDef<
      boolean,
      { number: "num/eq" }
    >,
  },
  lifts: { number: "num/literal" },
  nodeKinds: ["num/literal", "num/add", "num/mul", "num/sub", "num/eq"],
  defaultInterpreter: (): Interpreter => ({
    "num/literal": async function* (e) {
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
} as const;

/** Unified string operations plugin with interpreter. */
export const strPluginU = {
  name: "str",
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
  },
  traits: {
    eq: { output: false as boolean, mapping: { string: "str/eq" } } as TraitDef<
      boolean,
      { string: "str/eq" }
    >,
  },
  lifts: { string: "str/literal" },
  nodeKinds: ["str/literal", "str/eq"],
  defaultInterpreter: (): Interpreter => ({
    "str/literal": async function* (e) {
      return e.out as string;
    },
    "str/eq": async function* () {
      return ((yield 0) as string) === ((yield 1) as string);
    },
  }),
} as const;

/** Unified boolean operations plugin with interpreter. */
export const boolPluginU = {
  name: "bool",
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { boolean: "bool/eq" } } as TraitDef<
      boolean,
      { boolean: "bool/eq" }
    >,
  },
  lifts: { boolean: "bool/literal" },
  nodeKinds: ["bool/literal", "bool/eq"],
  defaultInterpreter: (): Interpreter => ({
    "bool/literal": async function* (e) {
      return e.out as boolean;
    },
    "bool/eq": async function* () {
      return ((yield 0) as boolean) === ((yield 1) as boolean);
    },
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
    "num/lt": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "str/lt": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
  },
  traits: {
    lt: { output: false as boolean, mapping: { number: "num/lt", string: "str/lt" } } as TraitDef<
      boolean,
      { number: "num/lt"; string: "str/lt" }
    >,
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
} as const;
