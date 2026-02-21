/**
 * Map — type-preserving node transformation.
 *
 * MapAdj replaces matched entries while preserving others.
 * MapOut updates output type when the root matches.
 * mapWhere applies a transformation function to matching nodes.
 */

import type { NodeEntry, NExpr, RuntimeEntry } from "./expr";
import { makeNExpr } from "./expr";
import type { PredBase, EvalPred } from "./predicates";

/** Replace matched entries in adj, preserve the rest. */
export type MapAdj<
  Adj,
  P,
  NewEntry extends NodeEntry<string, string[], any>,
> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? NewEntry
      : Adj[K]
    : Adj[K];
};

/** Update output type when root matches the predicate. */
export type MapOut<
  O,
  Adj,
  RootID extends string,
  P,
  NewEntry extends NodeEntry<string, string[], any>,
> = RootID extends keyof Adj
  ? EvalPred<P, Adj[RootID & keyof Adj], RootID, Adj> extends true
    ? NewEntry extends NodeEntry<any, any, infer NewO> ? NewO : O
    : O
  : O;

/** Union of entry types that match the predicate. */
export type MatchingEntries<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true ? Adj[K] : never
    : never;
}[keyof Adj];

/** Transform matching nodes in an NExpr using a mapping function. */
export function mapWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewEntry extends NodeEntry<string, string[], any>,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
  fn: (entry: MatchingEntries<Adj, P>) => NewEntry,
): NExpr<
  MapOut<O, Adj, R, P, NewEntry>,
  R,
  MapAdj<Adj, P, NewEntry>,
  C
> {
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      newAdj[id] = fn(entry as MatchingEntries<Adj, P>);
    } else {
      newAdj[id] = entry;
    }
  }
  return makeNExpr(expr.__id as R, newAdj, expr.__counter as C) as any;
}
