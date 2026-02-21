/**
 * Koan 10: Commit — runtime validation gate
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - commit(dirtyExpr) → NExpr after runtime validation
 * - Validation: root must exist in adj
 * - Validation: all children referenced by entries must exist in adj
 * - commit throws on dangling child references
 * - commit throws on missing root
 * - dirty → commit round-trip preserves all data
 * - dirty → swap → commit produces correct result
 * - dirty → addEntry → gc → commit cleans orphans before validation
 *
 * Imports: 09-dirty (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/10-commit.ts
 *   npx tsx spike-koans/10-commit.ts
 */

export * from "./10-dirty";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  IdOf,
  CtrOf,
  RuntimeEntry,
  LiveAdj,
  DirtyExpr,
  DirtyAdjOf,
} from "./10-dirty";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  liveAdj,
  dirty,
  addEntry,
  removeEntry,
  swapEntry,
  setRoot,
} from "./10-dirty";

// ─── gc: remove unreachable nodes from DirtyExpr ─────────────────────
export function gc<
  O,
  R extends string,
  Adj,
  C extends string,
>(d: DirtyExpr<O, R, Adj, C>): DirtyExpr<O, R, LiveAdj<Adj, R>, C> {
  const live = liveAdj(d.__adj, d.__id);
  return { __id: d.__id, __adj: live, __counter: d.__counter } as any;
}

// ─── commit: validate and convert DirtyExpr → NExpr ──────────────────
export function commit<
  O,
  R extends string,
  Adj,
  C extends string,
>(d: DirtyExpr<O, R, Adj, C>): NExpr<O, R, Adj, C> {
  const adj = d.__adj;
  const rootId = d.__id;
  if (!adj[rootId]) {
    throw new Error(`commit: root "${rootId}" not in adj`);
  }
  for (const [id, entry] of Object.entries(adj)) {
    for (const child of entry.children) {
      if (!adj[child]) {
        throw new Error(
          `commit: node "${id}" references missing child "${child}"`,
        );
      }
    }
  }
  return makeNExpr(rootId, adj, d.__counter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- Round-trip: dirty → commit preserves types ---
const roundTrip = commit(dirty(prog));
type RTId = IdOf<typeof roundTrip>;
const _rtId: RTId = "e";
type RTAdj = AdjOf<typeof roundTrip>;
const _rtA: RTAdj["a"]["kind"] = "num/literal";
const _rtE: RTAdj["e"]["kind"] = "num/mul";

// --- dirty → swap → commit ---
const swapped = commit(
  swapEntry(dirty(prog), "c", {
    kind: "num/sub" as const,
    children: ["a", "b"] as const,
    out: 0 as number,
  }),
);
type SwAdj = AdjOf<typeof swapped>;
const _swC: SwAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was swapped from "num/add"
const _swCBad: SwAdj["c"]["kind"] = "num/add";
const _swA: SwAdj["a"]["kind"] = "num/literal"; // preserved

// --- dirty → addEntry → gc → commit ---
const withOrphan = addEntry(dirty(prog), "orphan", {
  kind: "dead" as const, children: [] as const, out: undefined,
});
const cleaned = commit(gc(withOrphan));
type CleanAdj = AdjOf<typeof cleaned>;
const _clA: CleanAdj["a"]["kind"] = "num/literal";
const _clE: CleanAdj["e"]["kind"] = "num/mul";
// @ts-expect-error — orphan was gc'd
type _clOrphan = CleanAdj["orphan"]["kind"];

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

// Round-trip
assert(roundTrip.__id === "e", "round-trip root");
assert(roundTrip.__adj["a"].kind === "num/literal", "round-trip a");
assert(roundTrip.__adj["e"].kind === "num/mul", "round-trip e");
assert(Object.keys(roundTrip.__adj).length === 5, "round-trip 5 entries");

// dirty → swap → commit
assert(swapped.__adj["c"].kind === "num/sub", "swap c is num/sub");
assert(swapped.__adj["a"].kind === "num/literal", "swap a preserved");

// dirty → addEntry → gc → commit
assert(!("orphan" in cleaned.__adj), "orphan gc'd");
assert(Object.keys(cleaned.__adj).length === 5, "gc'd to 5 entries");
assert(cleaned.__adj["e"].kind === "num/mul", "gc'd root preserved");

// commit throws on missing root
let threwMissingRoot = false;
try {
  commit(setRoot(dirty(prog), "nonexistent"));
} catch (e: any) {
  threwMissingRoot = e.message.includes("root");
}
assert(threwMissingRoot, "throws on missing root");

// commit throws on dangling children
let threwDangling = false;
try {
  commit(removeEntry(dirty(prog), "a"));
} catch (e: any) {
  threwDangling = e.message.includes("missing child");
}
assert(threwDangling, "throws on dangling child");

// commit succeeds after fixing dangling refs
const fixed = commit(
  swapEntry(
    removeEntry(dirty(prog), "a"),
    "c",
    { kind: "num/add", children: ["b", "b"], out: undefined },
  ),
);
assert(fixed.__adj["c"].kind === "num/add", "fixed c still add");
assert(
  JSON.stringify(fixed.__adj["c"].children) === '["b","b"]',
  "fixed c children rewired",
);
assert(!("a" in fixed.__adj), "a removed in fixed");

console.log(`\n10-commit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
