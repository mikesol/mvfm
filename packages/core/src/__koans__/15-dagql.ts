/**
 * Koan 14: DagQL — functional chaining via pipe
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - pipe(expr, op1, op2, ...) chains operations with full type precision
 * - Each operation is a plain function: NExpr → NExpr
 * - No class wrapper, no catch-all, no type softening
 * - Removed keys properly error after splice (not any)
 * - Chained: replace add→sub, then splice literals, verify result
 * - Types flow through each step with zero loss
 *
 * Design decision:
 * - Functional pipe instead of class-based fluent API
 * - Each operation independently satisfies NExpr's Adj constraint
 * - No DagQLAdj workaround needed — AdjOf works directly
 *
 * Imports: 13-named (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/14-dagql.ts
 *   npx tsx spike-koans/14-dagql.ts
 */

export * from "./14-named";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  OutOf,
  PredBase,
} from "./14-named";
import {
  numLit,
  add,
  mul,
  app,
  byKind,
  isLeaf,
  mapWhere,
  replaceWhere,
  spliceWhere,
} from "./14-named";

// ─── pipe: functional chaining with full type flow ──────────────────
// Overloads for 1–5 operations. Each step is NExpr → NExpr.

export function pipe<A extends NExpr<any, any, any, any>, B>(
  expr: A, f1: (a: A) => B,
): B;
export function pipe<A extends NExpr<any, any, any, any>, B, C>(
  expr: A, f1: (a: A) => B, f2: (b: B) => C,
): C;
export function pipe<A extends NExpr<any, any, any, any>, B, C, D>(
  expr: A, f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D,
): D;
export function pipe<A extends NExpr<any, any, any, any>, B, C, D, E>(
  expr: A, f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E,
): E;
export function pipe(expr: any, ...fns: Array<(x: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), expr);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// (3+4)*5: a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Single replaceWhere via pipe ---
const justReplace = pipe(
  prog,
  (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
);
type JRAdj = AdjOf<typeof justReplace>;
const _jrC: JRAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _jrCBad: JRAdj["c"]["kind"] = "num/add";
const _jrA: JRAdj["a"]["kind"] = "num/literal"; // preserved

// --- Chained: replace add→sub, then splice literals ---
const chained = pipe(
  prog,
  (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
  (e) => spliceWhere(e, isLeaf()),
);
type ChAdj = AdjOf<typeof chained>;

// c is now "num/sub" with empty children (leaves spliced)
const _chC: ChAdj["c"]["kind"] = "num/sub";
const _chCCh: ChAdj["c"]["children"] = [];

// e is "num/mul" with children ["c"] (d was a leaf, spliced)
const _chE: ChAdj["e"]["kind"] = "num/mul";
const _chECh: ChAdj["e"]["children"] = ["c"];

// Literals removed — FULL PRECISION, no catch-all
// @ts-expect-error — "a" was spliced
type _chA = ChAdj["a"]["kind"];
// @ts-expect-error — "d" was spliced
type _chD = ChAdj["d"]["kind"];

// Root unchanged
type ChId = IdOf<typeof chained>;
const _chId: ChId = "e";

// --- Single spliceWhere via pipe ---
const justSplice = pipe(
  prog,
  (e) => spliceWhere(e, isLeaf()),
);
type JSAdj = AdjOf<typeof justSplice>;
const _jsC: JSAdj["c"]["kind"] = "num/add";
const _jsCCh: JSAdj["c"]["children"] = [];
const _jsECh: JSAdj["e"]["children"] = ["c"];
// @ts-expect-error — "a" was spliced
type _jsA = JSAdj["a"]["kind"];

// --- Three-step chain: replace, map, splice ---
const tripleChain = pipe(
  prog,
  (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
  (e) => mapWhere(e, byKind("num/mul"), (entry) => ({
    kind: "num/product" as const,
    children: entry.children,
    out: entry.out,
  })),
  (e) => spliceWhere(e, isLeaf()),
);
type TCAdj = AdjOf<typeof tripleChain>;
const _tcC: TCAdj["c"]["kind"] = "num/sub";
const _tcE: TCAdj["e"]["kind"] = "num/product";
const _tcECh: TCAdj["e"]["children"] = ["c"];
// @ts-expect-error — "a" was spliced
type _tcA = TCAdj["a"]["kind"];

// --- Output type tracks through pipe ---
type TCOut = OutOf<typeof tripleChain>;
const _tcOut: TCOut = 42;
// @ts-expect-error — still number
const _tcOutBad: TCOut = "nope";

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

// Single replace
assert(justReplace.__adj["c"].kind === "num/sub", "replace c is num/sub");
assert(justReplace.__adj["a"].kind === "num/literal", "replace a preserved");

// Chained: replace + splice
assert(chained.__adj["c"].kind === "num/sub", "chain c is num/sub");
assert(
  JSON.stringify(chained.__adj["c"].children) === "[]",
  "chain c children empty",
);
assert(chained.__adj["e"].kind === "num/mul", "chain e is num/mul");
assert(
  JSON.stringify(chained.__adj["e"].children) === '["c"]',
  "chain e children = [c]",
);
assert(!("a" in chained.__adj), "chain a spliced");
assert(!("d" in chained.__adj), "chain d spliced");
assert(chained.__id === "e", "chain root unchanged");
assert(Object.keys(chained.__adj).length === 2, "chain 2 nodes survive");

// Single splice
assert(
  JSON.stringify(justSplice.__adj["c"].children) === "[]",
  "splice c children empty",
);
assert(
  JSON.stringify(justSplice.__adj["e"].children) === '["c"]',
  "splice e children = [c]",
);

// Triple chain
assert(tripleChain.__adj["c"].kind === "num/sub", "triple c is num/sub");
assert(tripleChain.__adj["e"].kind === "num/product", "triple e is num/product");
assert(!("a" in tripleChain.__adj), "triple a spliced");
assert(Object.keys(tripleChain.__adj).length === 2, "triple 2 nodes survive");

console.log(`\n14-dagql: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
