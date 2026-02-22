/**
 * Bool plugin — boolean operations: and, or, not, implies, eq, neq, show, tt, ff.
 *
 * Split from std-plugins.ts to stay under 300-line limit.
 */

import { boolAnd as and, boolLit, boolNot as not, boolOr as or } from "./constructors";
import type { Interpreter, TraitDef } from "./plugin";
import type { KindSpec } from "./registry";

// ─── Bool plugin ─────────────────────────────────────────────────────

/** Unified boolean operations plugin with interpreter. */
export const boolPlugin = {
  name: "bool",
  ctors: { boolLit, and, or, not },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
    "bool/neq": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
    "bool/and": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
    "bool/or": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
    "bool/not": {
      inputs: [false] as [boolean],
      output: false as boolean,
    } as KindSpec<[boolean], boolean>,
    "bool/implies": {
      inputs: [false, false] as [boolean, boolean],
      output: false as boolean,
    } as KindSpec<[boolean, boolean], boolean>,
    "bool/show": {
      inputs: [false] as [boolean],
      output: "" as string,
    } as KindSpec<[boolean], string>,
    "bool/tt": { inputs: [] as [], output: true as boolean } as KindSpec<[], boolean>,
    "bool/ff": { inputs: [] as [], output: false as boolean } as KindSpec<[], boolean>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { boolean: "bool/eq" } } as TraitDef<
      boolean,
      { boolean: "bool/eq" }
    >,
    neq: { output: false as boolean, mapping: { boolean: "bool/neq" } } as TraitDef<
      boolean,
      { boolean: "bool/neq" }
    >,
    show: { output: "" as string, mapping: { boolean: "bool/show" } } as TraitDef<
      string,
      { boolean: "bool/show" }
    >,
  },
  lifts: { boolean: "bool/literal" },
  nodeKinds: [
    "bool/literal",
    "bool/eq",
    "bool/neq",
    "bool/and",
    "bool/or",
    "bool/not",
    "bool/implies",
    "bool/show",
    "bool/tt",
    "bool/ff",
  ],
  defaultInterpreter: (): Interpreter => ({
    "bool/literal": async function* (e) {
      return e.out as boolean;
    },
    "bool/eq": async function* () {
      return ((yield 0) as boolean) === ((yield 1) as boolean);
    },
    "bool/neq": async function* () {
      return ((yield 0) as boolean) !== ((yield 1) as boolean);
    },
    "bool/and": async function* () {
      return ((yield 0) as boolean) && ((yield 1) as boolean);
    },
    "bool/or": async function* () {
      return ((yield 0) as boolean) || ((yield 1) as boolean);
    },
    "bool/not": async function* () {
      return !((yield 0) as boolean);
    },
    "bool/implies": async function* () {
      return !((yield 0) as boolean) || ((yield 1) as boolean);
    },
    "bool/show": async function* () {
      return String((yield 0) as boolean);
    },
    "bool/tt": async function* () {
      return true;
    },
    "bool/ff": async function* () {
      return false;
    },
  }),
} as const;
