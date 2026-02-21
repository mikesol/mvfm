/**
 * Koan 05: Select — runtime node selection via predicates
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - selectWhere(expr, pred) returns Set<string & SelectKeys<Adj, P>>
 * - Runtime set matches type-level SelectKeys
 * - byKind("num/add") on (3+4)*5 → {"c"}
 * - isLeaf() → {"a", "b", "d"} (the three literals)
 * - byKindGlob("num/") → all 5 nodes
 * - not(isLeaf()) → {"c", "e"} (add and mul)
 * - and(byKindGlob("num/"), hasChildCount(2)) → {"c", "e"}
 * - Type-level: selected key is assignable to "c", not to "a"
 *
 * Imports: 04-predicates (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/05-select.ts
 *   npx tsx spike-koans/05-select.ts
 */

export * from "./05-predicates";

import type {
  NExpr,
  AdjOf,
  NodeEntry,
  PredBase,
  SelectKeys,
} from "./05-predicates";
import {
  numLit,
  add,
  mul,
  app,
  byKind,
  byKindGlob,
  isLeaf,
  hasChildCount,
  not,
  and,
} from "./05-predicates";

// ─── selectWhere: runtime selection with type-level key tracking ─────
export function selectWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
): Set<string & SelectKeys<Adj, P>> {
  const result = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      result.add(id);
    }
  }
  return result as Set<string & SelectKeys<Adj, P>>;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- byKind("num/add") → Set containing "c" ---
const adds = selectWhere(prog, byKind("num/add"));
type AddKeyType = typeof adds extends Set<infer K> ? K : never;
const _addC: AddKeyType = "c";
// @ts-expect-error — "a" is not an add node
const _addBad: AddKeyType = "a";

// --- isLeaf() → Set containing "a", "b", "d" ---
const leaves = selectWhere(prog, isLeaf());
type LeafKeyType = typeof leaves extends Set<infer K> ? K : never;
const _leafA: LeafKeyType = "a";
const _leafB: LeafKeyType = "b";
const _leafD: LeafKeyType = "d";
// @ts-expect-error — "c" has children
const _leafBad: LeafKeyType = "c";

// --- not(isLeaf()) → Set containing "c", "e" ---
const branches = selectWhere(prog, not(isLeaf()));
type BranchKeyType = typeof branches extends Set<infer K> ? K : never;
const _brC: BranchKeyType = "c";
const _brE: BranchKeyType = "e";
// @ts-expect-error — "a" is a leaf
const _brBad: BranchKeyType = "a";

// --- and(byKindGlob("num/"), hasChildCount(2)) → "c", "e" ---
const binary = selectWhere(prog, and(byKindGlob("num/"), hasChildCount(2)));
type BinKeyType = typeof binary extends Set<infer K> ? K : never;
const _binC: BinKeyType = "c";
const _binE: BinKeyType = "e";
// @ts-expect-error — "a" has 0 children
const _binBad: BinKeyType = "a";

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

function setEq(actual: Set<string>, expected: string[], msg: string) {
  const sortedA = Array.from(actual).sort();
  const sortedE = expected.slice().sort();
  assert(
    JSON.stringify(sortedA) === JSON.stringify(sortedE),
    `${msg}: got {${sortedA}} expected {${sortedE}}`,
  );
}

// byKind("num/add")
setEq(selectWhere(prog, byKind("num/add")), ["c"], "byKind num/add");

// byKind("num/mul")
setEq(selectWhere(prog, byKind("num/mul")), ["e"], "byKind num/mul");

// byKind("num/literal")
setEq(
  selectWhere(prog, byKind("num/literal")),
  ["a", "b", "d"],
  "byKind num/literal",
);

// isLeaf()
setEq(selectWhere(prog, isLeaf()), ["a", "b", "d"], "isLeaf");

// byKindGlob("num/")
setEq(
  selectWhere(prog, byKindGlob("num/")),
  ["a", "b", "c", "d", "e"],
  "byKindGlob num/",
);

// not(isLeaf())
setEq(selectWhere(prog, not(isLeaf())), ["c", "e"], "not isLeaf");

// hasChildCount(2)
setEq(selectWhere(prog, hasChildCount(2)), ["c", "e"], "hasChildCount 2");

// hasChildCount(0)
setEq(selectWhere(prog, hasChildCount(0)), ["a", "b", "d"], "hasChildCount 0");

// and(byKindGlob("num/"), hasChildCount(2))
setEq(
  selectWhere(prog, and(byKindGlob("num/"), hasChildCount(2))),
  ["c", "e"],
  "and(kindGlob, childCount)",
);

// Empty result
setEq(selectWhere(prog, byKind("str/literal")), [], "no match");

console.log(`\n05-select: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
