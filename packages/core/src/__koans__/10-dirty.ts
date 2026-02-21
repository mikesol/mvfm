/**
 * Koan 09: Dirty — mutable transaction primitives
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - DirtyExpr<O, R> is phantom-branded separately from NExpr (dirtyBrand)
 * - dirty(expr) converts NExpr → DirtyExpr
 * - DirtyExpr cannot be passed where NExpr is expected (structural incompatibility)
 * - addEntry(d, id, entry) adds to adj type via intersection
 * - removeEntry(d, id) removes from adj type via Omit
 * - swapEntry(d, id, entry) replaces in adj type via Omit & Record
 * - rewireChildren(d, oldRef, newRef) updates children arrays
 * - setRoot(d, newRootId) changes the root ID
 * - All operations preserve non-targeted entries
 *
 * Design decision:
 * - Separate dirtyBrand (not shared with NExpr) prevents any structural
 *   overlap between NExpr and DirtyExpr
 *
 * Imports: 08-gc (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/09-dirty.ts
 */

export * from "./09-gc";

import type { NodeEntry, NExpr, AdjOf, IdOf, CtrOf, RuntimeEntry } from "./09-gc";
import { numLit, add, mul, app } from "./09-gc";

// ─── DirtyExpr: phantom-branded, incompatible with NExpr ─────────────
declare const dirtyBrand: unique symbol;

export interface DirtyExpr<
  O,
  RootId extends string,
  Adj,
  Ctr extends string,
> {
  readonly [dirtyBrand]: {
    readonly o: O;
    readonly rootId: RootId;
    readonly adj: Adj;
    readonly ctr: Ctr;
  };
  readonly __id: string;
  readonly __adj: Record<string, RuntimeEntry>;
  readonly __counter: string;
}

// ─── Extractors ──────────────────────────────────────────────────────
export type DirtyIdOf<D> =
  D extends DirtyExpr<any, infer R, any, any> ? R : never;
export type DirtyAdjOf<D> =
  D extends DirtyExpr<any, any, infer A, any> ? A : never;
export type DirtyCtrOf<D> =
  D extends DirtyExpr<any, any, any, infer C> ? C : never;
export type DirtyOutOf<D> =
  D extends DirtyExpr<infer O, any, any, any> ? O : never;

// ─── dirty: NExpr → DirtyExpr ────────────────────────────────────────
export function dirty<
  O, R extends string,
  Adj,
  C extends string,
>(expr: NExpr<O, R, Adj, C>): DirtyExpr<O, R, Adj, C> {
  return {
    __id: expr.__id, __adj: { ...expr.__adj }, __counter: expr.__counter,
  } as unknown as DirtyExpr<O, R, Adj, C>;
}

// ─── addEntry: adj grows via intersection ────────────────────────────
export function addEntry<
  O, R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], any>,
>(
  d: DirtyExpr<O, R, Adj, C>, id: Id, entry: E,
): DirtyExpr<O, R, Adj & Record<Id, E>, C> {
  const newAdj = { ...d.__adj, [id]: entry };
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── removeEntry: adj shrinks via Omit ───────────────────────────────
export function removeEntry<
  O, R extends string,
  Adj,
  C extends string,
  Id extends string,
>(
  d: DirtyExpr<O, R, Adj, C>, id: Id,
): DirtyExpr<O, R, { [K in keyof Adj as K extends Id ? never : K]: Adj[K] }, C> {
  const newAdj = { ...d.__adj };
  delete newAdj[id];
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── swapEntry: replace via Omit & Record ────────────────────────────
export function swapEntry<
  O, R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], any>,
>(
  d: DirtyExpr<O, R, Adj, C>, id: Id, entry: E,
): DirtyExpr<O, R, { [K in keyof Adj as K extends Id ? never : K]: Adj[K] } & Record<Id, E>, C> {
  const newAdj = { ...d.__adj, [id]: entry };
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── rewireChildren: global find-and-replace in children arrays ──────
type RewireList<
  C extends string[], Old extends string, New extends string,
> = C extends [infer H extends string, ...infer T extends string[]]
  ? [H extends Old ? New : H, ...RewireList<T, Old, New>]
  : [];

export type RewireAdj<
  Adj, Old extends string, New extends string,
> = {
  [K in keyof Adj]: Adj[K] extends NodeEntry<
    infer Kind extends string, infer C extends string[], infer O
  >
    ? NodeEntry<Kind, RewireList<C, Old, New>, O>
    : Adj[K];
};

export function rewireChildren<
  O, R extends string,
  Adj,
  C extends string,
  Old extends string, New extends string,
>(
  d: DirtyExpr<O, R, Adj, C>, oldRef: Old, newRef: New,
): DirtyExpr<O, R, RewireAdj<Adj, Old, New>, C> {
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(d.__adj)) {
    newAdj[id] = {
      ...entry,
      children: entry.children.map((c) => (c === oldRef ? newRef : c)),
    };
  }
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── setRoot: change root ID ─────────────────────────────────────────
export function setRoot<
  O, R extends string,
  Adj,
  C extends string,
  NewRoot extends string,
>(
  d: DirtyExpr<O, R, Adj, C>, newRootId: NewRoot,
): DirtyExpr<O, NewRoot, Adj, C> {
  return { __id: newRootId, __adj: d.__adj, __counter: d.__counter } as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- dirty produces DirtyExpr with same type info ---
const d = dirty(prog);
type DId = DirtyIdOf<typeof d>;
const _dId: DId = "e";
type DAdj = DirtyAdjOf<typeof d>;
const _dAdjA: DAdj["a"]["kind"] = "num/literal";

// --- DirtyExpr is NOT assignable to NExpr ---
// @ts-expect-error — different brands, structurally incompatible
const _incompatible: typeof prog = d;

// --- addEntry: adj grows ---
const d2 = addEntry(d, "f", {
  kind: "debug/log" as const, children: ["e"] as ["e"], out: undefined,
} as const);
type D2Adj = DirtyAdjOf<typeof d2>;
const _d2F: D2Adj["f"]["kind"] = "debug/log";
const _d2A: D2Adj["a"]["kind"] = "num/literal"; // original preserved

// --- removeEntry: adj shrinks ---
const d3 = removeEntry(d, "a");
type D3Adj = DirtyAdjOf<typeof d3>;
// @ts-expect-error — "a" has been removed
type _d3A = D3Adj["a"]["kind"];
const _d3B: D3Adj["b"]["kind"] = "num/literal"; // others preserved

// --- swapEntry: replaces entry ---
const d4 = swapEntry(d, "c", {
  kind: "num/sub" as const, children: ["a", "b"] as ["a", "b"], out: 0 as number,
} as const);
type D4Adj = DirtyAdjOf<typeof d4>;
const _d4C: D4Adj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _d4CBad: D4Adj["c"]["kind"] = "num/add";
const _d4A: D4Adj["a"]["kind"] = "num/literal"; // preserved

// --- rewireChildren: global child replacement ---
const d5 = rewireChildren(d, "a", "b");
type D5Adj = DirtyAdjOf<typeof d5>;
// "c" had children ["a","b"], now ["b","b"]
const _d5CChildren: D5Adj["c"]["children"] = ["b", "b"];
// @ts-expect-error — "a" is no longer in c's children
const _d5CBad: D5Adj["c"]["children"] = ["a", "b"];
// "e" had children ["c","d"], no "a" refs, unchanged
const _d5EChildren: D5Adj["e"]["children"] = ["c", "d"];

// --- setRoot: changes root ID ---
const d6 = setRoot(d, "c");
type D6Id = DirtyIdOf<typeof d6>;
const _d6Id: D6Id = "c";
// @ts-expect-error — root is now "c", not "e"
const _d6IdBad: D6Id = "e";

// --- Chained operations (STORY.md example) ---
const chain = setRoot(
  rewireChildren(
    removeEntry(
      addEntry(d, "f", {
        kind: "debug/log" as const,
        children: ["e"] as ["e"],
        out: undefined,
      } as const),
      "a",
    ),
    "a", "b",
  ),
  "f",
);
type ChainId = DirtyIdOf<typeof chain>;
const _chainId: ChainId = "f";
type ChainAdj = DirtyAdjOf<typeof chain>;
const _chainF: ChainAdj["f"]["kind"] = "debug/log";
// "a" was removed
// @ts-expect-error — "a" removed by removeEntry
type _chainA = ChainAdj["a"]["kind"];
