/**
 * Koan 12: Splice — remove matched nodes and reconnect
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - SpliceList<C, Adj, Matched> recursively replaces matched refs with their children
 * - SpliceAdj<Adj, Matched> removes matched nodes, reconnects surviving children
 * - SpliceRoot<R, Adj, Matched> takes first child if root is matched
 * - spliceWhere(expr, pred) removes all matching nodes, reconnects parents
 * - Wrap-then-splice round-trips to original structure
 * - Double-wrap-then-splice: recursive reconnection through two layers
 * - Splice leaves: parent children become empty where leaves were
 * - Splice root: new root is first child of spliced root
 * - Surviving nodes' types preserved, spliced nodes' keys gone from adj
 *
 * Imports: 11-wrap (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/12-splice.ts
 *   npx tsx spike-koans/12-splice.ts
 */

export * from "./12-wrap";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  RuntimeEntry,
  PredBase,
  SelectKeys,
} from "./12-wrap";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  wrapByName,
  byKind,
  isLeaf,
} from "./12-wrap";

// ─── SpliceList: replace matched children with their own children ────
// Recursive: if a replaced child's children are also matched, they're spliced too.
type SpliceList<
  C extends string[],
  Adj,
  Matched extends string,
> = C extends [infer H extends string, ...infer T extends string[]]
  ? H extends Matched
    ? H extends keyof Adj
      ? Adj[H] extends NodeEntry<any, infer HC extends string[], any>
        ? [...SpliceList<HC, Adj, Matched>, ...SpliceList<T, Adj, Matched>]
        : SpliceList<T, Adj, Matched>
      : SpliceList<T, Adj, Matched>
    : [H, ...SpliceList<T, Adj, Matched>]
  : [];

// ─── SpliceAdj: remove matched nodes, reconnect children ────────────
export type SpliceAdj<
  Adj,
  Matched extends string,
> = {
  [K in keyof Adj as K extends Matched ? never : K]:
    Adj[K] extends NodeEntry<
      infer Kind extends string, infer Ch extends string[], infer O
    >
      ? NodeEntry<Kind, SpliceList<Ch, Adj, Matched>, O>
      : Adj[K];
};

// ─── SpliceRoot: if root is matched, take first child ────────────────
type SpliceRoot<
  R extends string,
  Adj,
  Matched extends string,
> = R extends Matched
  ? R extends keyof Adj
    ? Adj[R] extends NodeEntry<
        any, [infer First extends string, ...string[]], any
      >
      ? First
      : R
    : R
  : R;

// ─── spliceWhere: remove matching nodes, reconnect ───────────────────
export function spliceWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
): NExpr<
  O,
  SpliceRoot<R, Adj, SelectKeys<Adj, P>>,
  SpliceAdj<Adj, SelectKeys<Adj, P>>,
  C
> {
  const matched = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      matched.add(id);
    }
  }

  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (matched.has(id)) continue;
    newAdj[id] = {
      ...entry,
      children: rSplice(entry.children, expr.__adj, matched),
    };
  }

  let newRoot = expr.__id;
  if (matched.has(newRoot)) {
    const rootEntry = expr.__adj[newRoot];
    if (rootEntry && rootEntry.children.length > 0) {
      newRoot = rootEntry.children[0];
    }
  }

  return makeNExpr(newRoot, newAdj, expr.__counter) as any;
}

function rSplice(
  children: string[],
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
): string[] {
  const result: string[] = [];
  for (const c of children) {
    if (matched.has(c)) {
      const entry = adj[c];
      if (entry) result.push(...rSplice(entry.children, adj, matched));
    } else {
      result.push(c);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// (3+4)*5: a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Wrap-then-splice round-trip ---
const wrapped = wrapByName(prog, "c", "debug/wrap");
const roundTripped = spliceWhere(wrapped, byKind("debug/wrap"));
type RTAdj = AdjOf<typeof roundTripped>;

const _rtC: RTAdj["c"]["kind"] = "num/add";
const _rtA: RTAdj["a"]["kind"] = "num/literal";
const _rtE: RTAdj["e"]["kind"] = "num/mul";

// Children reconnected: e → ["c","d"] again
const _rtECh: RTAdj["e"]["children"] = ["c", "d"];
// @ts-expect-error — was ["f","d"] before splice
const _rtEChBad: RTAdj["e"]["children"] = ["f", "d"];

// Root unchanged
type RTId = IdOf<typeof roundTripped>;
const _rtId: RTId = "e";

// Wrapper removed from adj
// @ts-expect-error — "f" was spliced out
type _rtF = RTAdj["f"]["kind"];

// --- Double-wrap then splice: recursive reconnection ---
const w1 = wrapByName(prog, "c", "debug/wrap");
const w2 = wrapByName(w1, "f", "debug/wrap");
const dblSpliced = spliceWhere(w2, byKind("debug/wrap"));
type DSAdj = AdjOf<typeof dblSpliced>;

// e reconnected through two wrappers back to c
const _dsECh: DSAdj["e"]["children"] = ["c", "d"];
const _dsC: DSAdj["c"]["kind"] = "num/add";
const _dsCCh: DSAdj["c"]["children"] = ["a", "b"];

// Both wrappers removed
// @ts-expect-error — "f" spliced
type _dsF = DSAdj["f"]["kind"];
// @ts-expect-error — "g" spliced
type _dsG = DSAdj["g"]["kind"];

// --- Splice leaves: parents get empty children ---
const noLeaves = spliceWhere(prog, isLeaf());
type NLAdj = AdjOf<typeof noLeaves>;

// c had children [a,b], both leaves → []
const _nlCCh: NLAdj["c"]["children"] = [];
// @ts-expect-error — was ["a","b"]
const _nlCChBad: NLAdj["c"]["children"] = ["a", "b"];

// e had children [c,d], d is a leaf → ["c"]
const _nlECh: NLAdj["e"]["children"] = ["c"];

// Surviving nodes' kinds preserved
const _nlC: NLAdj["c"]["kind"] = "num/add";
const _nlE: NLAdj["e"]["kind"] = "num/mul";

// Leaves removed
// @ts-expect-error — "a" was spliced
type _nlA = NLAdj["a"]["kind"];
// @ts-expect-error — "b" was spliced
type _nlB = NLAdj["b"]["kind"];
// @ts-expect-error — "d" was spliced
type _nlD = NLAdj["d"]["kind"];

// Root unchanged (not a leaf)
type NLId = IdOf<typeof noLeaves>;
const _nlId: NLId = "e";

// --- Splice root: new root is first child ---
const noMul = spliceWhere(prog, byKind("num/mul"));
type NMId = IdOf<typeof noMul>;
const _nmId: NMId = "c";
// @ts-expect-error — root is "c", not "e"
const _nmIdBad: NMId = "e";

type NMAdj = AdjOf<typeof noMul>;
// @ts-expect-error — "e" was spliced
type _nmE = NMAdj["e"]["kind"];

const _nmC: NMAdj["c"]["kind"] = "num/add";
const _nmA: NMAdj["a"]["kind"] = "num/literal";

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

// Wrap-then-splice round-trip
assert(roundTripped.__adj["c"].kind === "num/add", "round-trip c kind");
assert(
  JSON.stringify(roundTripped.__adj["e"].children) === '["c","d"]',
  "round-trip e children reconnected",
);
assert(!("f" in roundTripped.__adj), "wrapper removed");
assert(roundTripped.__id === "e", "round-trip root unchanged");
assert(Object.keys(roundTripped.__adj).length === 5, "round-trip 5 entries");

// Double-wrap-then-splice
assert(
  JSON.stringify(dblSpliced.__adj["e"].children) === '["c","d"]',
  "double-wrap e reconnected to c",
);
assert(!("f" in dblSpliced.__adj), "wrapper f removed");
assert(!("g" in dblSpliced.__adj), "wrapper g removed");
assert(Object.keys(dblSpliced.__adj).length === 5, "double-wrap 5 entries");

// Splice leaves
assert(
  JSON.stringify(noLeaves.__adj["c"].children) === "[]",
  "c children empty after leaf splice",
);
assert(
  JSON.stringify(noLeaves.__adj["e"].children) === '["c"]',
  "e children = [c] after leaf splice",
);
assert(!("a" in noLeaves.__adj), "leaf a removed");
assert(!("b" in noLeaves.__adj), "leaf b removed");
assert(!("d" in noLeaves.__adj), "leaf d removed");
assert(noLeaves.__id === "e", "leaf splice root unchanged");
assert(Object.keys(noLeaves.__adj).length === 2, "2 nodes survive leaf splice");

// Splice root
assert(noMul.__id === "c", "splice root: new root is c");
assert(!("e" in noMul.__adj), "root e removed");
assert(noMul.__adj["c"].kind === "num/add", "c preserved after root splice");
assert(noMul.__adj["a"].kind === "num/literal", "a preserved after root splice");
assert(Object.keys(noMul.__adj).length === 4, "4 nodes after root splice");

console.log(`\n12-splice: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
