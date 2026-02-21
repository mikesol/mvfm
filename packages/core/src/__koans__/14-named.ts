/**
 * Koan 13: Named — alias nodes and name-based predicates
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - NameAlias<Name, TargetID, Out> is a metadata entry in adj keyed as "@Name"
 * - name(expr, n, targetId) adds the alias without consuming a counter
 * - byName("the-sum") matches the target node (not the alias entry)
 * - selectWhere + byName finds the right node
 * - replaceWhere + byName transforms the right node
 * - Standard gc removes aliases (they're unreachable from root)
 * - gcPreservingAliases keeps aliases alive through gc
 *
 * Imports: 12-splice (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/13-named.ts
 *   npx tsx spike-koans/13-named.ts
 */

export * from "./13-splice";

import type {
  NodeEntry,
  NExpr,
  AdjOf,
  CtrOf,
  RuntimeEntry,
  SelectKeys,
  NamePred,
  DirtyExpr,
  DirtyAdjOf,
  LiveAdj,
} from "./13-splice";
import {
  makeNExpr,
  numLit,
  add,
  mul,
  app,
  byName,
  selectWhere,
  replaceWhere,
  dirty,
  gc,
  commit,
  liveAdj,
} from "./13-splice";

// ─── NameAlias: metadata entry keyed as "@Name" in adj ──────────────
export type NameAlias<
  Name extends string,
  TargetID extends string,
  Out,
> = NodeEntry<"@alias", [TargetID], Out>;

// ─── TargetOut: extract output type of target node ──────────────────
type TargetOut<Adj, ID extends string> = ID extends keyof Adj
  ? Adj[ID] extends NodeEntry<any, any, infer O> ? O : unknown
  : unknown;

// ─── name: add @Name alias to adj (no counter consumed) ─────────────
export function name<
  O,
  R extends string,
  Adj,
  C extends string,
  N extends string,
  T extends string,
>(
  expr: NExpr<O, R, Adj, C>,
  n: N,
  targetId: T,
): NExpr<
  O, R,
  Adj & Record<`@${N}`, NameAlias<N, T, TargetOut<Adj, T>>>,
  C
> {
  const targetEntry = expr.__adj[targetId];
  const newAdj = {
    ...expr.__adj,
    [`@${n}`]: {
      kind: "@alias",
      children: [targetId],
      out: targetEntry ? targetEntry.out : undefined,
    },
  };
  return makeNExpr(expr.__id, newAdj, expr.__counter) as any;
}

// ─── PreserveAliases: keep @* keys from adj ─────────────────────────
export type PreserveAliases<Adj> = {
  [K in keyof Adj as K extends `@${string}` ? K : never]: Adj[K];
};

// ─── gcPreservingAliases: alias-aware gc ────────────────────────────
export function gcPreservingAliases<
  O,
  R extends string,
  Adj,
  C extends string,
>(
  d: DirtyExpr<O, R, Adj, C>,
): DirtyExpr<O, R, LiveAdj<Adj, R> & PreserveAliases<Adj>, C> {
  const live = liveAdj(d.__adj, d.__id);
  for (const [k, v] of Object.entries(d.__adj)) {
    if (k.startsWith("@")) live[k] = v;
  }
  return { __id: d.__id, __adj: live, __counter: d.__counter } as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// (3+4)*5: a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// --- name adds @alias entry ---
const named = name(prog, "the-sum", "c");
type NAdj = AdjOf<typeof named>;

const _aliasKind: NAdj["@the-sum"]["kind"] = "@alias";
const _aliasCh: NAdj["@the-sum"]["children"] = ["c"];

// Original entries preserved
const _namedC: NAdj["c"]["kind"] = "num/add";
const _namedE: NAdj["e"]["kind"] = "num/mul";

// Counter unchanged (no counter consumed)
type NCtr = CtrOf<typeof named>;
const _nCtr: NCtr = "f";

// --- selectWhere + byName finds target ---
type NameKeys = SelectKeys<NAdj, NamePred<"the-sum">>;
const _nameKey: NameKeys = "c";
// @ts-expect-error — "e" is not the alias target
const _nameKeyBad: NameKeys = "e";
// @ts-expect-error — "@the-sum" itself is not selected
const _nameKeyAlias: NameKeys = "@the-sum";

// --- replaceWhere + byName transforms target ---
const replaced = replaceWhere(named, byName("the-sum"), "num/sub");
type RAdj = AdjOf<typeof replaced>;
const _repC: RAdj["c"]["kind"] = "num/sub";
// @ts-expect-error — was "num/add", now "num/sub"
const _repCBad: RAdj["c"]["kind"] = "num/add";
// Others preserved
const _repA: RAdj["a"]["kind"] = "num/literal";
const _repE: RAdj["e"]["kind"] = "num/mul";

// --- Standard gc removes alias (unreachable from root) ---
const dirtyNamed = dirty(named);
const gcResult = gc(dirtyNamed);
type GCAdj = DirtyAdjOf<typeof gcResult>;
// @ts-expect-error — alias was gc'd (not reachable from root)
type _gcAlias = GCAdj["@the-sum"]["kind"];
// Regular nodes survive
const _gcC: GCAdj["c"]["kind"] = "num/add";

// --- gcPreservingAliases keeps alias alive ---
const gcpaResult = gcPreservingAliases(dirtyNamed);
type GCPAAdj = DirtyAdjOf<typeof gcpaResult>;
const _gcpaAlias: GCPAAdj["@the-sum"]["kind"] = "@alias";
const _gcpaC: GCPAAdj["c"]["kind"] = "num/add";

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

// name adds alias
assert(named.__adj["@the-sum"].kind === "@alias", "alias kind is @alias");
assert(
  named.__adj["@the-sum"].children[0] === "c",
  "alias target is c",
);
assert(named.__adj["c"].kind === "num/add", "original c preserved");
assert(named.__counter === "f", "counter unchanged by name");

// selectWhere + byName
const selSet = selectWhere(named, byName("the-sum"));
assert(selSet.has("c" as any), "byName selects target c");
assert(selSet.size === 1, "byName selects only target");
assert(!selSet.has("@the-sum" as any), "byName does not select alias entry");

// replaceWhere + byName
assert(replaced.__adj["c"].kind === "num/sub", "byName replace changes kind");
assert(replaced.__adj["a"].kind === "num/literal", "byName replace preserves a");
assert(replaced.__adj["e"].kind === "num/mul", "byName replace preserves e");

// Standard gc removes alias
const committedGC = commit(gc(dirtyNamed));
assert(!("@the-sum" in committedGC.__adj), "standard gc removes alias");
assert("c" in committedGC.__adj, "standard gc keeps regular nodes");
assert(Object.keys(committedGC.__adj).length === 5, "gc'd to 5 entries");

// gcPreservingAliases keeps alias
const committedGCPA = commit(gcPreservingAliases(dirtyNamed));
assert(
  "@the-sum" in committedGCPA.__adj,
  "alias-aware gc keeps alias",
);
assert("c" in committedGCPA.__adj, "alias-aware gc keeps regular nodes");
assert(
  Object.keys(committedGCPA.__adj).length === 6,
  "alias-aware gc keeps 6 entries",
);

console.log(`\n13-named: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
