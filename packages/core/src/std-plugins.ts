/**
 * Standard plugin definitions — num, str, bool, ord.
 *
 * These are the built-in unified plugins with interpreters.
 * Split from plugin.ts to stay under 300-line limit.
 */

import {
  abs,
  add,
  ceil,
  div,
  floor,
  max,
  min,
  mod,
  mul,
  neg,
  numLit,
  round,
  sub,
} from "./constructors";
import type { Interpreter, TraitDef } from "./plugin";
import type { KindSpec } from "./registry";
import { boolPlugin as _boolPlugin } from "./std-plugins-bool";
import { strPlugin as _strPlugin } from "./std-plugins-str";

// ─── Unified plugin definitions ─────────────────────────────────────

/** Unified numeric operations plugin with interpreter. */
export const numPlugin = {
  name: "num",
  ctors: { add, mul, sub, div, mod, min, max, neg, abs, floor, ceil, round, numLit },
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
    "num/div": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/mod": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/neg": { inputs: [0] as [number], output: 0 as number } as KindSpec<[number], number>,
    "num/abs": { inputs: [0] as [number], output: 0 as number } as KindSpec<[number], number>,
    "num/floor": { inputs: [0] as [number], output: 0 as number } as KindSpec<[number], number>,
    "num/ceil": { inputs: [0] as [number], output: 0 as number } as KindSpec<[number], number>,
    "num/round": { inputs: [0] as [number], output: 0 as number } as KindSpec<[number], number>,
    "num/min": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/max": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/show": { inputs: [0] as [number], output: "" as string } as KindSpec<[number], string>,
    "num/compare": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
    "num/eq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "num/neq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "num/zero": { inputs: [] as [], output: 0 as number } as KindSpec<[], number>,
    "num/one": { inputs: [] as [], output: 1 as number } as KindSpec<[], number>,
    "num/top": { inputs: [] as [], output: 0 as number } as KindSpec<[], number>,
    "num/bottom": { inputs: [] as [], output: 0 as number } as KindSpec<[], number>,
  },
  traits: {
    eq: { output: false as boolean, mapping: { number: "num/eq" } } as TraitDef<
      boolean,
      { number: "num/eq" }
    >,
    neq: { output: false as boolean, mapping: { number: "num/neq" } } as TraitDef<
      boolean,
      { number: "num/neq" }
    >,
    show: { output: "" as string, mapping: { number: "num/show" } } as TraitDef<
      string,
      { number: "num/show" }
    >,
  },
  lifts: { number: "num/literal" },
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
    "num/div": async function* () {
      return ((yield 0) as number) / ((yield 1) as number);
    },
    "num/mod": async function* () {
      return ((yield 0) as number) % ((yield 1) as number);
    },
    "num/neg": async function* () {
      return -((yield 0) as number);
    },
    "num/abs": async function* () {
      return Math.abs((yield 0) as number);
    },
    "num/floor": async function* () {
      return Math.floor((yield 0) as number);
    },
    "num/ceil": async function* () {
      return Math.ceil((yield 0) as number);
    },
    "num/round": async function* () {
      return Math.round((yield 0) as number);
    },
    "num/min": async function* () {
      return Math.min((yield 0) as number, (yield 1) as number);
    },
    "num/max": async function* () {
      return Math.max((yield 0) as number, (yield 1) as number);
    },
    "num/show": async function* () {
      return String((yield 0) as number);
    },
    "num/compare": async function* () {
      const a = (yield 0) as number;
      const b = (yield 1) as number;
      return a < b ? -1 : a > b ? 1 : 0;
    },
    "num/eq": async function* () {
      return ((yield 0) as number) === ((yield 1) as number);
    },
    "num/neq": async function* () {
      return ((yield 0) as number) !== ((yield 1) as number);
    },
    "num/zero": async function* () {
      return 0;
    },
    "num/one": async function* () {
      return 1;
    },
    "num/top": async function* () {
      return Number.MAX_SAFE_INTEGER;
    },
    "num/bottom": async function* () {
      return Number.MIN_SAFE_INTEGER;
    },
  }),
} as const;

// Str, bool, and ord plugins split to separate files to stay under 300-line limit.
export { boolPlugin } from "./std-plugins-bool";
export { lt, ordPlugin } from "./std-plugins-ord";
export { strPlugin } from "./std-plugins-str";

/** Standard plugin tuple: num + str + bool. */
export const stdPlugins = [numPlugin, _strPlugin, _boolPlugin] as const;
