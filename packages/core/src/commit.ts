/**
 * Commit — validate and convert DirtyExpr back to NExpr.
 *
 * gc removes unreachable nodes from DirtyExpr.
 * commit validates that all child references exist before
 * converting back to an immutable NExpr.
 */

import type { DirtyExpr } from "./dirty";
import type { NExpr } from "./expr";
import { makeNExpr } from "./expr";
import type { LiveAdj } from "./gc";
import { liveAdj } from "./gc";
import { extractChildIds } from "./structural-children";

/** Remove unreachable nodes from a DirtyExpr. */
export function gc<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): DirtyExpr<O, R, LiveAdj<Adj, R>, C> {
  const live = liveAdj(d.__adj, d.__id);
  return { __id: d.__id, __adj: live, __counter: d.__counter } as any;
}

/** Validate and convert a DirtyExpr back to an immutable NExpr. */
export function commit<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): NExpr<O, R, Adj, C> {
  const adj = d.__adj;
  const rootId = d.__id;
  if (!adj[rootId]) {
    throw new Error(`commit: root "${rootId}" not in adj`);
  }
  for (const [id, entry] of Object.entries(adj)) {
    for (const child of extractChildIds(entry.children)) {
      if (!adj[child]) {
        throw new Error(`commit: node "${id}" references missing child "${child}"`);
      }
    }
  }
  return makeNExpr(rootId, adj, d.__counter) as any;
}
