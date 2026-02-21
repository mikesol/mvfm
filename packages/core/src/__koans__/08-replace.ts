/**
 * Koan 07: Replace — kind substitution convenience
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - replaceWhere(expr, pred, newKind) is a thin wrapper over mapWhere
 * - It preserves children and out, only changing kind
 * - replaceWhere(prod, byKind("num/add"), "num/sub") → adj["c"].kind is "num/sub"
 * - Type-level: the new kind is reflected in the adj entry type
 *
 * Imports: 06-map (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/07-replace.ts
 *   npx tsx spike-koans/07-replace.ts
 */

export * from "./07-map";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  OutOf,
  PredBase,
  EvalPred,
  MapAdj,
  MapOut,
  MatchingEntries,
} from "./07-map";
import {
  mapWhere,
  numLit,
  add,
  mul,
  app,
  byKind,
  byKindGlob,
  isLeaf,
  and,
} from "./07-map";

// ─── ReplaceKind: swap kind, preserve children + out ─────────────────
// Distributes over union of matching entries
type ReplaceKind<
  Entry,
  NewKind extends string,
> = Entry extends NodeEntry<any, infer C extends string[], infer O>
  ? NodeEntry<NewKind, C, O>
  : never;

// ─── replaceWhere: thin wrapper over mapWhere ────────────────────────
export function replaceWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewKind extends string,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
  newKind: NewKind,
): NExpr<
  MapOut<O, Adj, R, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  R,
  MapAdj<Adj, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  C
> {
  return mapWhere(expr, pred, (entry: any) => ({
    kind: newKind,
    children: entry.children,
    out: entry.out,
  })) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Replace add→sub: adj["c"].kind becomes "num/sub" ---
const replaced = replaceWhere(prog, byKind("num/add"), "num/sub");
type RAdj = AdjOf<typeof replaced>;
const _rC: RAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _rCBad: RAdj["c"]["kind"] = "num/add";

// Children and out preserved
const _rCChildren: RAdj["c"]["children"] = ["a", "b"];

// Unmatched entries untouched
const _rA: RAdj["a"]["kind"] = "num/literal";
const _rE: RAdj["e"]["kind"] = "num/mul";

// Output type unchanged (root didn't match)
type ROut = OutOf<typeof replaced>;
const _rOut: ROut = 42;
// @ts-expect-error — still number
const _rOutBad: ROut = "nope";

// --- Replace root: output type changes ---
const rootReplaced = replaceWhere(prog, byKind("num/mul"), "str/repr");
type RRAdj = AdjOf<typeof rootReplaced>;
const _rrE: RRAdj["e"]["kind"] = "str/repr";
// Children preserved on root
const _rrEChildren: RRAdj["e"]["children"] = ["c", "d"];
// Non-root untouched
const _rrA: RRAdj["a"]["kind"] = "num/literal";

// --- Replace all leaves ---
const leavesReplaced = replaceWhere(prog, isLeaf(), "num/const");
type LRAdj = AdjOf<typeof leavesReplaced>;
const _lrA: LRAdj["a"]["kind"] = "num/const";
const _lrB: LRAdj["b"]["kind"] = "num/const";
const _lrD: LRAdj["d"]["kind"] = "num/const";
// Branches untouched
const _lrC: LRAdj["c"]["kind"] = "num/add";
const _lrE: LRAdj["e"]["kind"] = "num/mul";

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

// Replace add→sub
assert(replaced.__adj["c"].kind === "num/sub", "c kind is num/sub");
assert(replaced.__adj["a"].kind === "num/literal", "a preserved");
assert(replaced.__adj["e"].kind === "num/mul", "e preserved");
assert(
  JSON.stringify(replaced.__adj["c"].children) === '["a","b"]',
  "c children preserved",
);

// Replace root
assert(rootReplaced.__adj["e"].kind === "str/repr", "root kind is str/repr");
assert(rootReplaced.__adj["a"].kind === "num/literal", "a preserved");

// Replace all leaves
assert(leavesReplaced.__adj["a"].kind === "num/const", "leaf a replaced");
assert(leavesReplaced.__adj["b"].kind === "num/const", "leaf b replaced");
assert(leavesReplaced.__adj["d"].kind === "num/const", "leaf d replaced");
assert(leavesReplaced.__adj["c"].kind === "num/add", "branch c untouched");
assert(leavesReplaced.__adj["e"].kind === "num/mul", "branch e untouched");

console.log(`\n07-replace: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
