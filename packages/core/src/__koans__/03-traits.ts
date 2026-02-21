/**
 * Koan 03: Traits — plugin composition (simplified)
 *
 * Trait dispatch is now deferred to app() time. Construction just
 * records "eq" with raw args. The registry + app() resolve which
 * specific kind (num/eq, str/eq, etc.) to use.
 *
 * Plugin shapes provide:
 * - ctors: permissive constructors
 * - kinds: registry entries for their node kinds
 * - traits: trait instance mappings (type → kind)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/03-traits.ts
 */

export * from "./02-build";

import type {
  CExpr,
  COutOf,
  CKindOf,
  CArgsOf,
  KindSpec,
  TraitKindSpec,
  StdRegistry,
} from "./02-build";
import { makeCExpr, add, mul, eq, numLit, strLit, boolLit } from "./02-build";

// ─── PluginShape: what a plugin provides ────────────────────────────
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

export const numPlugin = {
  ctors: { add, mul, numLit },
  kinds: {
    "num/literal": { inputs: [], output: 0 as number } as KindSpec<[], number>,
    "num/add": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<[number, number], number>,
    "num/mul": { inputs: [0, 0] as [number, number], output: 0 as number } as KindSpec<[number, number], number>,
    "num/eq": { inputs: [0, 0] as [number, number], output: false as boolean } as KindSpec<[number, number], boolean>,
  },
  traits: {
    eq: { number: "num/eq" },
  },
} as const;

export const strPlugin = {
  ctors: { strLit },
  kinds: {
    "str/literal": { inputs: [], output: "" as string } as KindSpec<[], string>,
    "str/eq": { inputs: ["", ""] as [string, string], output: false as boolean } as KindSpec<[string, string], boolean>,
  },
  traits: {
    eq: { string: "str/eq" },
  },
} as const;

export const boolPlugin = {
  ctors: { boolLit },
  kinds: {
    "bool/literal": { inputs: [], output: false as boolean } as KindSpec<[], boolean>,
    "bool/eq": { inputs: [false, false] as [boolean, boolean], output: false as boolean } as KindSpec<[boolean, boolean], boolean>,
  },
  traits: {
    eq: { boolean: "bool/eq" },
  },
} as const;

// ─── mvfm: compose plugins ─────────────────────────────────────────
// Returns merged ctors + eq constructor. Registry is implicit (StdRegistry).

type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

type MergeCtors<Plugins extends readonly PluginShape<any, any, any>[]> =
  UnionToIntersection<Plugins[number]["ctors"]>;

type DollarSign<Plugins extends readonly PluginShape<any, any, any>[]> =
  MergeCtors<Plugins> & { eq: typeof eq };

export function mvfm<
  const P extends readonly PluginShape<any, any, any>[],
>(...plugins: P): DollarSign<P> {
  const allCtors: Record<string, unknown> = {};
  for (const plugin of plugins) {
    Object.assign(allCtors, plugin.ctors);
  }
  return { ...allCtors, eq } as DollarSign<P>;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// --- eq produces CExpr<boolean> ---
const eqNums = eq(3, 4);
type EqOut = COutOf<typeof eqNums>;
const _eqOut: EqOut = true;
// @ts-expect-error — boolean, not number
const _eqOutBad: EqOut = 42;
type EqKind = CKindOf<typeof eqNums>;
const _eqKind: EqKind = "eq";

// --- eq with CExpr children ---
const eqExprs = eq(add(3, 4), add(5, 6));
type EqExprsOut = COutOf<typeof eqExprs>;
const _eqExprsOut: EqExprsOut = false;

// --- eq with strings ---
const eqStrs = eq("hello", "world");
type EqStrsKind = CKindOf<typeof eqStrs>;
const _eqStrsKind: EqStrsKind = "eq";

// --- Permissive: eq(3, "foo") compiles (error at app()) ---
const eqMixed = eq(3, "foo");
type EqMixedOut = COutOf<typeof eqMixed>;
const _eqMixedOut: EqMixedOut = true; // optimistic boolean

// --- mvfm composition ---
const $ = mvfm(numPlugin, strPlugin);

const n = $.add(1, 2);
type NKind = CKindOf<typeof n>;
const _nKind: NKind = "num/add";

const e = $.eq(1, 2);
type EKind = CKindOf<typeof e>;
const _eKind: EKind = "eq";

// --- Nested eq: eq(eq(3,3), eq(5,5)) ---
const nested = eq(eq(3, 3), eq(5, 5));
type NestedOut = COutOf<typeof nested>;
const _nestedOut: NestedOut = true;
