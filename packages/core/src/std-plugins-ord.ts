/**
 * Ord plugin — ordering operations: lt, gt, gte, lte, compare for numbers and strings.
 *
 * Split from std-plugins.ts to stay under 300-line limit.
 */

import type { CExpr } from "./expr";
import { makeCExpr } from "./expr";
import type { Interpreter, TraitDef } from "./plugin";
import type { KindSpec } from "./registry";

// ─── Ord constructor ─────────────────────────────────────────────────

/** Create a less-than comparison expression (trait-dispatched). */
export function lt<A, B>(a: A, b: B): CExpr<boolean, "lt", [A, B]> {
  return makeCExpr("lt", [a, b]);
}

// ─── Ord plugin ──────────────────────────────────────────────────────

/** Ordering plugin with comparison traits for numbers and strings. */
export const ordPlugin = {
  name: "ord",
  ctors: { lt },
  kinds: {
    "num/lt": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "num/gt": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "num/gte": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "num/lte": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<
      [number, number],
      boolean
    >,
    "str/lt": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
    "str/gt": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
    "str/gte": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
    "str/lte": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<
      [string, string],
      boolean
    >,
    "str/compare": { inputs: ["", ""] as [string, string], output: 0 as number } as KindSpec<
      [string, string],
      number
    >,
    "num/compare": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<
      [number, number],
      number
    >,
  },
  traits: {
    lt: { output: false as boolean, mapping: { number: "num/lt", string: "str/lt" } } as TraitDef<
      boolean,
      { number: "num/lt"; string: "str/lt" }
    >,
    gt: { output: false as boolean, mapping: { number: "num/gt", string: "str/gt" } } as TraitDef<
      boolean,
      { number: "num/gt"; string: "str/gt" }
    >,
    gte: {
      output: false as boolean,
      mapping: { number: "num/gte", string: "str/gte" },
    } as TraitDef<boolean, { number: "num/gte"; string: "str/gte" }>,
    lte: {
      output: false as boolean,
      mapping: { number: "num/lte", string: "str/lte" },
    } as TraitDef<boolean, { number: "num/lte"; string: "str/lte" }>,
    compare: {
      output: 0 as number,
      mapping: { number: "num/compare", string: "str/compare" },
    } as TraitDef<number, { number: "num/compare"; string: "str/compare" }>,
  },
  lifts: {},
  nodeKinds: [
    "num/lt",
    "num/gt",
    "num/gte",
    "num/lte",
    "str/lt",
    "str/gt",
    "str/gte",
    "str/lte",
    "str/compare",
    "num/compare",
  ],
  defaultInterpreter: (): Interpreter => ({
    "num/lt": async function* () {
      return ((yield 0) as number) < ((yield 1) as number);
    },
    "num/gt": async function* () {
      return ((yield 0) as number) > ((yield 1) as number);
    },
    "num/gte": async function* () {
      return ((yield 0) as number) >= ((yield 1) as number);
    },
    "num/lte": async function* () {
      return ((yield 0) as number) <= ((yield 1) as number);
    },
    "str/lt": async function* () {
      return ((yield 0) as string) < ((yield 1) as string);
    },
    "str/gt": async function* () {
      return ((yield 0) as string) > ((yield 1) as string);
    },
    "str/gte": async function* () {
      return ((yield 0) as string) >= ((yield 1) as string);
    },
    "str/lte": async function* () {
      return ((yield 0) as string) <= ((yield 1) as string);
    },
    "str/compare": async function* () {
      const a = (yield 0) as string;
      const b = (yield 1) as string;
      return a < b ? -1 : a > b ? 1 : 0;
    },
    "num/compare": async function* () {
      const a = (yield 0) as number;
      const b = (yield 1) as number;
      return a < b ? -1 : a > b ? 1 : 0;
    },
  }),
} as const;
