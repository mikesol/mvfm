/**
 * Koan 03: Normalize — app boundary, CExpr → NExpr
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - Normalize<Adj, RootId> performs type-level post-order DFS
 * - ProcessNode/ProcessChildren walk the content-addressed adj
 * - Each visited node gets a sequential ID ("a", "b", "c", ...)
 * - DAG sharing: already-visited nodes reuse their assigned ID (no duplication)
 * - AccMap tracks old→new ID mapping, AccEntries accumulates the new adj
 * - app(cexpr) calls Normalize and returns NExpr<O, RootId, Adj, Ctr>
 *
 * Example: mul(add(numLit(3), numLit(4)), numLit(5))
 *   Content-addressed: "M(A(L3,L4),L5)" with keys L3, L4, A(L3,L4), L5, M(...)
 *   Normalized:        "e" with keys a, b, c, d, e (post-order DFS)
 *     a: num/literal []
 *     b: num/literal []
 *     c: num/add ["a","b"]
 *     d: num/literal []
 *     e: num/mul ["c","d"]
 *
 * This is the boundary between construction (ephemeral CExpr) and
 * everything downstream (NExpr with clean sequential IDs).
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/03-normalize.ts
 *   npx tsx spike-koans/03-normalize.ts
 */

import type {
  NodeEntry,
  CExpr,
  CIdOf,
  CAdjOf,
  COutOf,
  NExpr,
  IdOf,
  AdjOf,
  CtrOf,
  RuntimeEntry,
} from "./00-expr";
import { makeNExpr } from "./00-expr";
import type { Increment } from "./01-increment";
import { incrementId } from "./01-increment";
import { numLit, add, mul } from "./02-build";

// ─── Type-level normalizer ───────────────────────────────────────────
// Result tuple: [Map, Entries, Counter, NewId]
//   Map: Record<oldId, newId> — tracks visited nodes
//   Entries: accumulated normalized adjacency map
//   Counter: next available sequential ID
//   NewId: the new ID assigned to the processed node

export type ProcessNode<
  Adj,
  NodeId extends string,
  Map,
  Entries,
  Ctr extends string,
> = NodeId extends keyof Map
  ? [Map, Entries, Ctr, Map[NodeId & keyof Map]]
  : NodeId extends keyof Adj
    ? Adj[NodeId] extends NodeEntry<
        infer K extends string,
        infer C extends string[],
        infer O
      >
      ? ProcessChildren<Adj, C, Map, Entries, Ctr> extends [
          infer M2,
          infer E2,
          infer C2 extends string,
          infer NC extends string[],
        ]
        ? [
            M2 & Record<NodeId, C2>,
            E2 & Record<C2, NodeEntry<K, NC, O>>,
            Increment<C2>,
            C2,
          ]
        : never
      : never
    : never;

export type ProcessChildren<
  Adj,
  Children extends string[],
  Map,
  Entries,
  Ctr extends string,
> = Children extends []
  ? [Map, Entries, Ctr, []]
  : Children extends [
        infer Head extends string,
        ...infer Tail extends string[],
      ]
    ? ProcessNode<Adj, Head, Map, Entries, Ctr> extends [
        infer M2,
        infer E2,
        infer C2 extends string,
        infer NewId extends string,
      ]
      ? ProcessChildren<Adj, Tail, M2, E2, C2> extends [
          infer M3,
          infer E3,
          infer C3 extends string,
          infer NC extends string[],
        ]
        ? [M3, E3, C3, [NewId, ...NC]]
        : never
      : never
    : never;

export type Normalize<
  Adj,
  RootId extends string,
> = ProcessNode<Adj, RootId, {}, {}, "a">;

// ─── AppResult: single extraction from Normalize ─────────────────────
type AppResult<
  O,
  Adj,
  RootId extends string,
> = Normalize<Adj, RootId> extends [
  any,
  infer E,
  infer C extends string,
  infer R extends string,
]
  ? NExpr<O, R, E, C>
  : never;

// ─── app: CExpr → NExpr ─────────────────────────────────────────────
export function app<
  O,
  Id extends string,
  Adj,
>(cexpr: CExpr<O, Id, Adj>): AppResult<O, Adj, Id> {
  const oldAdj = cexpr.__adj;
  const rootId = cexpr.__id;
  const map: Record<string, string> = {};
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  function visit(nodeId: string): string {
    if (map[nodeId] !== undefined) return map[nodeId];
    const entry = oldAdj[nodeId];
    const newChildren = entry.children.map(visit);
    const newId = counter;
    counter = incrementId(counter);
    map[nodeId] = newId;
    entries[newId] = {
      kind: entry.kind,
      children: newChildren,
      out: entry.out,
    };
    return newId;
  }

  const newRoot = visit(rootId);
  return makeNExpr(newRoot, entries, counter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// Build: (3 + 4) * 5
const cexpr = mul(add(numLit(3), numLit(4)), numLit(5));
const prog = app(cexpr);

// --- Root ID is "e" ---
type ProgId = IdOf<typeof prog>;
const _progId: ProgId = "e";
// @ts-expect-error — root is "e", not "a"
const _progIdBad: ProgId = "a";

// --- Counter is "f" (next after "e") ---
type ProgCtr = CtrOf<typeof prog>;
const _progCtr: ProgCtr = "f";
// @ts-expect-error — counter is "f", not "e"
const _progCtrBad: ProgCtr = "e";

// --- Adj has correct kinds ---
type ProgAdj = AdjOf<typeof prog>;
const _aKind: ProgAdj["a"]["kind"] = "num/literal";
const _bKind: ProgAdj["b"]["kind"] = "num/literal";
const _cKind: ProgAdj["c"]["kind"] = "num/add";
const _dKind: ProgAdj["d"]["kind"] = "num/literal";
const _eKind: ProgAdj["e"]["kind"] = "num/mul";

// --- Children are remapped ---
const _cChildren: ProgAdj["c"]["children"] = ["a", "b"];
const _eChildren: ProgAdj["e"]["children"] = ["c", "d"];
const _aChildren: ProgAdj["a"]["children"] = [];

// @ts-expect-error — "c" children are ["a","b"], not ["L3","L4"]
const _cChildrenBad: ProgAdj["c"]["children"] = ["L3", "L4"];

// --- DAG sharing: same subtree used twice gets one ID ---
const shared = app(add(numLit(3), numLit(3)));
type SharedAdj = AdjOf<typeof shared>;
// Only one literal node ("a"), add references it twice
type SharedId = IdOf<typeof shared>;
const _sharedId: SharedId = "b";
const _sharedAKind: SharedAdj["a"]["kind"] = "num/literal";
const _sharedBKind: SharedAdj["b"]["kind"] = "num/add";
const _sharedBChildren: SharedAdj["b"]["children"] = ["a", "a"];

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

// (3 + 4) * 5
assert(prog.__id === "e", "root ID is e");
assert(prog.__counter === "f", "counter is f");

const adj = prog.__adj;
assert(Object.keys(adj).length === 5, "5 entries in adj");
assert(adj["a"].kind === "num/literal", "a is num/literal");
assert(adj["b"].kind === "num/literal", "b is num/literal");
assert(adj["c"].kind === "num/add", "c is num/add");
assert(adj["d"].kind === "num/literal", "d is num/literal");
assert(adj["e"].kind === "num/mul", "e is num/mul");

assert(JSON.stringify(adj["a"].children) === "[]", "a has no children");
assert(JSON.stringify(adj["c"].children) === '["a","b"]', "c children");
assert(JSON.stringify(adj["e"].children) === '["c","d"]', "e children");

// DAG sharing
const sh = app(add(numLit(3), numLit(3)));
assert(sh.__id === "b", "shared root is b");
assert(Object.keys(sh.__adj).length === 2, "shared has 2 entries");
assert(
  JSON.stringify(sh.__adj["b"].children) === '["a","a"]',
  "shared add refs a twice",
);

// Single leaf
const leaf = app(numLit(42));
assert(leaf.__id === "a", "leaf root is a");
assert(leaf.__counter === "b", "leaf counter is b");
assert(Object.keys(leaf.__adj).length === 1, "leaf has 1 entry");

console.log(`\n03-normalize: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
