import type { NodeEntry, RuntimeEntry } from "./expr";

type EntryRefSource = RuntimeEntry & { kind: string; out: unknown };

function collectIdsFromOut(
  value: unknown,
  adj: Record<string, RuntimeEntry>,
  refs: string[],
): void {
  if (typeof value === "string") {
    if (value in adj) refs.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIdsFromOut(item, adj, refs);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) collectIdsFromOut(nested, adj, refs);
  }
}

function entryRefs(entry: EntryRefSource, adj: Record<string, RuntimeEntry>): string[] {
  const refs = [...entry.children];
  if (entry.kind === "core/record" || entry.kind === "core/tuple") {
    collectIdsFromOut(entry.out, adj, refs);
  }
  return refs;
}

/** Type-level forward reachability from Queue over adjacency Adj. */
export type CollectReachable<
  Adj,
  Queue extends string[],
  Visited extends string = never,
> = Queue extends [infer Head extends string, ...infer Rest extends string[]]
  ? Head extends Visited
    ? CollectReachable<Adj, Rest, Visited>
    : Head extends keyof Adj
      ? Adj[Head] extends NodeEntry<string, infer C extends string[], unknown>
        ? CollectReachable<Adj, [...C, ...Rest], Visited | Head>
        : CollectReachable<Adj, Rest, Visited | Head>
      : CollectReachable<Adj, Rest, Visited | Head>
  : Visited;

/** Adjacency filtered to keys reachable from RootID. */
export type LiveAdj<Adj, RootID extends string> = {
  [K in keyof Adj as K extends CollectReachable<Adj, [RootID]> ? K : never]: Adj[K];
};

/** Runtime reachability closure from root id, including structural refs in `out`. */
export function collectReachable(adj: Record<string, RuntimeEntry>, rootId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const head = queue.shift();
    if (!head || visited.has(head)) continue;
    visited.add(head);
    const entry = adj[head];
    if (!entry) continue;
    for (const child of entryRefs(entry as EntryRefSource, adj)) {
      if (!visited.has(child)) queue.push(child);
    }
  }
  return visited;
}

/** Runtime adjacency filtered to reachable keys from root id. */
export function liveAdj(
  adj: Record<string, RuntimeEntry>,
  rootId: string,
): Record<string, RuntimeEntry> {
  const reachable = collectReachable(adj, rootId);
  const result: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(adj)) {
    if (reachable.has(id)) result[id] = entry;
  }
  return result;
}
