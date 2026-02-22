/**
 * GC — forward-reachability garbage collection.
 *
 * CollectReachable performs type-level queue-based forward DFS.
 * LiveAdj filters an adjacency map to only reachable nodes.
 * Runtime mirrors provide the same logic at runtime.
 */

import type { NodeEntry, RuntimeEntry } from "./expr";
import { extractChildIds } from "./structural-children";

/** Type-level forward DFS collecting reachable node IDs as a union. */
export type CollectReachable<
  Adj,
  Queue extends string[],
  Visited extends string = never,
> = Queue extends [infer Head extends string, ...infer Rest extends string[]]
  ? Head extends Visited
    ? CollectReachable<Adj, Rest, Visited>
    : Head extends keyof Adj
      ? Adj[Head] extends NodeEntry<any, infer C extends string[], any>
        ? CollectReachable<Adj, [...C, ...Rest], Visited | Head>
        : CollectReachable<Adj, Rest, Visited | Head>
      : CollectReachable<Adj, Rest, Visited | Head>
  : Visited;

/** Filter adjacency map to only nodes reachable from the root. */
export type LiveAdj<Adj, RootID extends string> = {
  [K in keyof Adj as K extends CollectReachable<Adj, [RootID]> ? K : never]: Adj[K];
};

/** Runtime forward DFS collecting reachable node IDs. */
export function collectReachable(adj: Record<string, RuntimeEntry>, rootId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const head = queue.shift()!;
    if (visited.has(head)) continue;
    visited.add(head);
    const entry = adj[head];
    if (entry) {
      const ids = extractChildIds(entry.children);
      for (let i = ids.length - 1; i >= 0; i--) {
        queue.unshift(ids[i]);
      }
    }
  }
  return visited;
}

/** Filter adjacency map at runtime to only reachable nodes. */
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
