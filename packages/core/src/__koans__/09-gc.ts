/**
 * Koan 08: GC — forward-reachability garbage collection
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - CollectReachable<Adj, Queue, Visited> performs queue-based forward DFS
 *   from the root, accumulating reachable node IDs as a union
 * - Each step: pop head from queue, skip if visited, otherwise add children
 *   to queue and head to visited
 * - Recursion depth = number of nodes processed (one per node, visited check)
 * - LiveAdj<Adj, RootID> filters adj to only reachable nodes via mapped type
 * - The mapped type runs once at the end — no nested mapped types per iteration
 *
 * Stress-test results (from spike):
 * - Chains: passes up to ~900 nodes (900 recursive steps, each lightweight)
 * - Trees: passes up to ~8000 nodes (recursion depth = total nodes, not depth)
 * - This is sufficient for realistic programs
 *
 * Why not iterative pruning (orphan-root detection)?
 * - Iterative pruning is conceptually elegant (zero-recursion per pass)
 * - But each PruneOnce is a mapped type over ALL keys, nested per iteration
 * - Breaks at ~147 chain nodes and ~255 tree nodes
 * - CollectReachable accumulates a union (lightweight) — 6x better on chains
 *
 * Imports: 07-replace (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/08-gc.ts
 *   npx tsx spike-koans/08-gc.ts
 */

export * from "./08-replace";

import type { NodeEntry, RuntimeEntry } from "./08-replace";

// ─── CollectReachable: type-level forward DFS ────────────────────────
// Queue is a tuple, Visited is a union. Each step pops the head:
//   - already visited → skip
//   - has children → enqueue them (DFS: children first)
//   - no entry → treat as leaf, add to visited
// Returns the union of all reachable IDs.
export type CollectReachable<
  Adj,
  Queue extends string[],
  Visited extends string = never,
> = Queue extends [
  infer Head extends string,
  ...infer Rest extends string[],
]
  ? Head extends Visited
    ? CollectReachable<Adj, Rest, Visited>
    : Head extends keyof Adj
      ? Adj[Head] extends NodeEntry<any, infer C extends string[], any>
        ? CollectReachable<Adj, [...C, ...Rest], Visited | Head>
        : CollectReachable<Adj, Rest, Visited | Head>
      : CollectReachable<Adj, Rest, Visited | Head>
  : Visited;

// ─── LiveAdj: filter adj to reachable nodes only ─────────────────────
// Single mapped type at the end — no nesting per iteration.
export type LiveAdj<
  Adj,
  RootID extends string,
> = {
  [K in keyof Adj as K extends CollectReachable<Adj, [RootID]>
    ? K
    : never]: Adj[K];
};

// ─── Runtime mirrors ─────────────────────────────────────────────────
export function collectReachable(
  adj: Record<string, RuntimeEntry>,
  rootId: string,
): Set<string> {
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const head = queue.shift()!;
    if (visited.has(head)) continue;
    visited.add(head);
    const entry = adj[head];
    if (entry) {
      for (let i = entry.children.length - 1; i >= 0; i--) {
        queue.unshift(entry.children[i]);
      }
    }
  }
  return visited;
}

export function liveAdj(
  adj: Record<string, RuntimeEntry>,
  rootId: string,
): Record<string, RuntimeEntry> {
  const reachable = collectReachable(adj, rootId);
  const result: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(adj)) {
    if (reachable.has(id)) {
      result[id] = entry;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// Test adj: a→b→c, plus orphan "x"
type TestAdj = {
  a: NodeEntry<"lit", [], number>;
  b: NodeEntry<"add", ["a"], number>;
  c: NodeEntry<"mul", ["b"], number>;
  x: NodeEntry<"orphan", [], number>;
};

// CollectReachable from root "c" → reaches c, b, a (not x)
type Reachable = CollectReachable<TestAdj, ["c"]>;
const _rc: Reachable = "c";
const _rb: Reachable = "b";
const _ra: Reachable = "a";
// @ts-expect-error — x is not reachable from c
const _rx: Reachable = "x";

// LiveAdj filters out x
type Live = LiveAdj<TestAdj, "c">;
const _liveC: Live["c"]["kind"] = "mul";
const _liveB: Live["b"]["kind"] = "add";
const _liveA: Live["a"]["kind"] = "lit";

// x is filtered out — accessing it is a compile error
// @ts-expect-error — x not in LiveAdj
type _liveX = Live["x"];

// --- DAG sharing: node reachable via two paths ---
type DagAdj = {
  s: NodeEntry<"shared", [], number>;
  l: NodeEntry<"left", ["s"], number>;
  r: NodeEntry<"right", ["s"], number>;
  root: NodeEntry<"top", ["l", "r"], number>;
  orphan: NodeEntry<"dead", [], number>;
};
type DagReachable = CollectReachable<DagAdj, ["root"]>;
const _dRoot: DagReachable = "root";
const _dL: DagReachable = "l";
const _dR: DagReachable = "r";
const _dS: DagReachable = "s";
// @ts-expect-error — orphan not reachable
const _dOrphan: DagReachable = "orphan";

type DagLive = LiveAdj<DagAdj, "root">;
// @ts-expect-error — orphan filtered out
type _dagOrphan = DagLive["orphan"];

// --- Single node (root only, no children) ---
type SingleAdj = { root: NodeEntry<"lit", [], number> };
type SingleReachable = CollectReachable<SingleAdj, ["root"]>;
const _single: SingleReachable = "root";

// --- Empty orphan set (all reachable) ---
type AllReachableAdj = {
  a: NodeEntry<"lit", [], number>;
  b: NodeEntry<"use", ["a"], number>;
};
type AllLive = LiveAdj<AllReachableAdj, "b">;
const _allA: AllLive["a"]["kind"] = "lit";
const _allB: AllLive["b"]["kind"] = "use";

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

// Chain with orphan
const chainAdj: Record<string, RuntimeEntry> = {
  a: { kind: "lit", children: [], out: 1 },
  b: { kind: "add", children: ["a"], out: 2 },
  c: { kind: "mul", children: ["b"], out: 3 },
  x: { kind: "orphan", children: [], out: 0 },
};
setEq(collectReachable(chainAdj, "c"), ["a", "b", "c"], "chain reachable");
const chainLive = liveAdj(chainAdj, "c");
assert(!("x" in chainLive), "orphan removed");
assert("a" in chainLive && "b" in chainLive && "c" in chainLive, "live kept");

// DAG with shared node
const dagAdj: Record<string, RuntimeEntry> = {
  s: { kind: "shared", children: [], out: 0 },
  l: { kind: "left", children: ["s"], out: 0 },
  r: { kind: "right", children: ["s"], out: 0 },
  root: { kind: "top", children: ["l", "r"], out: 0 },
  orphan: { kind: "dead", children: [], out: 0 },
};
setEq(
  collectReachable(dagAdj, "root"),
  ["root", "l", "r", "s"],
  "dag reachable",
);
const dagLive = liveAdj(dagAdj, "root");
assert(!("orphan" in dagLive), "dag orphan removed");
assert(Object.keys(dagLive).length === 4, "dag 4 live nodes");

// Single node
const singleAdj: Record<string, RuntimeEntry> = {
  root: { kind: "lit", children: [], out: 42 },
};
setEq(collectReachable(singleAdj, "root"), ["root"], "single reachable");

// All reachable (no orphans)
const allAdj: Record<string, RuntimeEntry> = {
  a: { kind: "lit", children: [], out: 1 },
  b: { kind: "use", children: ["a"], out: 2 },
};
const allLive = liveAdj(allAdj, "b");
assert(Object.keys(allLive).length === 2, "all reachable, none removed");

console.log(`\n08-gc: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
