/**
 * Koan 06: Map — type-preserving node transformation
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - MapAdj<Adj, P, NewEntry> replaces matching entries, preserves others
 * - MapOut<O, Adj, RootID, P, NewEntry> updates output type when root matches
 * - MatchingEntries<Adj, P> extracts the union of matched entry types
 * - mapWhere(expr, pred, fn) returns Expr with MapAdj and MapOut applied
 * - Rename add→sub: type-level adj["c"]["kind"] becomes "num/sub"
 * - Unmatched entries preserved: adj["a"]["kind"] stays "num/literal"
 * - Root mapping changes output type: map mul→str/repr changes O from number to string
 * - Compound predicate: and(byKindGlob("num/"), isLeaf()) maps only leaves
 *
 * Imports: 05-select (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/06-map.ts
 *   npx tsx spike-koans/06-map.ts
 */

export * from "./06-select";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  OutOf,
  RuntimeEntry,
  PredBase,
  EvalPred,
} from "./06-select";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  byKind,
  byKindGlob,
  isLeaf,
  and,
} from "./06-select";

// ─── MapAdj: replace matched entries, preserve the rest ──────────────
export type MapAdj<
  Adj,
  P,
  NewEntry extends NodeEntry<string, string[], any>,
> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? NewEntry
      : Adj[K]
    : Adj[K];
};

// ─── MapOut: update output type when root matches ────────────────────
export type MapOut<
  O,
  Adj,
  RootID extends string,
  P,
  NewEntry extends NodeEntry<string, string[], any>,
> = RootID extends keyof Adj
  ? EvalPred<P, Adj[RootID & keyof Adj], RootID, Adj> extends true
    ? NewEntry extends NodeEntry<any, any, infer NewO> ? NewO : O
    : O
  : O;

// ─── MatchingEntries: union of entry types that match ────────────────
export type MatchingEntries<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true ? Adj[K] : never
    : never;
}[keyof Adj];

// ─── mapWhere: runtime + typed mapper ────────────────────────────────
export function mapWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewEntry extends NodeEntry<string, string[], any>,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
  fn: (entry: MatchingEntries<Adj, P>) => NewEntry,
): NExpr<
  MapOut<O, Adj, R, P, NewEntry>,
  R,
  MapAdj<Adj, P, NewEntry>,
  C
> {
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      newAdj[id] = fn(entry as MatchingEntries<Adj, P>);
    } else {
      newAdj[id] = entry;
    }
  }
  return makeNExpr(expr.__id as R, newAdj, expr.__counter as C) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Rename add→sub: adj["c"]["kind"] becomes "num/sub" ---
const swapped = mapWhere(prog, byKind("num/add"), (entry) => ({
  kind: "num/sub" as const,
  children: entry.children,
  out: entry.out,
}));
type SwapAdj = AdjOf<typeof swapped>;
const _swapC: SwapAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _swapCBad: SwapAdj["c"]["kind"] = "num/add";

// --- Unmatched entries preserved ---
const _swapA: SwapAdj["a"]["kind"] = "num/literal";
const _swapE: SwapAdj["e"]["kind"] = "num/mul";

// --- Output type unchanged (root didn't match) ---
type SwapOut = OutOf<typeof swapped>;
const _swapOut: SwapOut = 42;
// @ts-expect-error — output is still number
const _swapOutBad: SwapOut = "not number";

// --- Root mapping changes output type ---
const stringified = mapWhere(prog, byKind("num/mul"), (_e) => ({
  kind: "str/repr" as const,
  children: ["c", "d"] as const,
  out: "" as string,
}));
type StrOut = OutOf<typeof stringified>;
const _strOut: StrOut = "hello";
// @ts-expect-error — output is now string, not number
const _strOutBad: StrOut = 42;

type StrAdj = AdjOf<typeof stringified>;
const _strRoot: StrAdj["e"]["kind"] = "str/repr";
// Unmatched preserved
const _strA: StrAdj["a"]["kind"] = "num/literal";

// --- Compound predicate: map only leaves ---
const leafMapped = mapWhere(
  prog,
  and(byKindGlob("num/"), isLeaf()),
  (entry) => ({
    kind: "num/const" as const,
    children: entry.children,
    out: entry.out,
  }),
);
type LMAdj = AdjOf<typeof leafMapped>;
const _lmA: LMAdj["a"]["kind"] = "num/const";
const _lmB: LMAdj["b"]["kind"] = "num/const";
const _lmD: LMAdj["d"]["kind"] = "num/const";
// Non-leaves untouched
const _lmC: LMAdj["c"]["kind"] = "num/add";
const _lmE: LMAdj["e"]["kind"] = "num/mul";

// --- Negative: tsc catches illegal casts in mapWhere callbacks ---

// Can't cast kind from number to string
const _badKind = mapWhere(prog, byKind("num/add"), (e) => ({
  // @ts-expect-error — number is not string
  kind: 42 as string,
  children: e.children,
  out: e.out,
}));

// Can't cast children to a wrong tuple
const _badChildren = mapWhere(prog, byKind("num/add"), (e) => ({
  kind: "num/sub" as const,
  // @ts-expect-error — ["x","y"] doesn't overlap with ["a","b"]
  children: ["x", "y"] as ["a", "b"],
  out: e.out,
}));

// Can't cast out to incompatible type
const _badOut = mapWhere(prog, byKind("num/add"), (e) => ({
  kind: "num/sub" as const,
  children: e.children,
  // @ts-expect-error — Error doesn't overlap with number
  out: new Error() as number,
}));

// Can't return a completely wrong shape
const _badShape = mapWhere(prog, byKind("num/add"), (_e) => ({
  // @ts-expect-error — number is not assignable to string
  kind: 123,
  // @ts-expect-error — boolean is not assignable to string[]
  children: true,
  out: Symbol(),
}));

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// Rename add→sub
assert(swapped.__adj["c"].kind === "num/sub", "c kind is num/sub");
assert(swapped.__adj["a"].kind === "num/literal", "a preserved");
assert(swapped.__adj["e"].kind === "num/mul", "e preserved");
assert(swapped.__id === "e", "root unchanged");

// Root mapping
assert(stringified.__adj["e"].kind === "str/repr", "e kind is str/repr");
assert(stringified.__adj["a"].kind === "num/literal", "a preserved in str");

// Compound: only leaves mapped
assert(leafMapped.__adj["a"].kind === "num/const", "leaf a mapped");
assert(leafMapped.__adj["b"].kind === "num/const", "leaf b mapped");
assert(leafMapped.__adj["d"].kind === "num/const", "leaf d mapped");
assert(leafMapped.__adj["c"].kind === "num/add", "branch c untouched");
assert(leafMapped.__adj["e"].kind === "num/mul", "branch e untouched");

// No entries lost
assert(Object.keys(swapped.__adj).length === 5, "swapped: 5 entries");
assert(Object.keys(leafMapped.__adj).length === 5, "leafMapped: 5 entries");

console.log(`\n06-map: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
