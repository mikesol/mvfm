/**
 * Map — type-preserving node transformation.
 *
 * MapAdj replaces matched entries while preserving others.
 * MapOut updates output type when the root matches.
 * mapWhere applies a transformation function to matching nodes.
 *
 * Type-safety: MapTypeSafe verifies that the callback's NewEntry output
 * type extends all matched entries' output types. Returns MapTypeError
 * (branded, not assignable to NExpr/DirtyExpr) when a mismatch is detected.
 *
 * Returns DirtyExpr requiring explicit commit() before fold.
 */

import type { DirtyExpr } from "./dirty";
import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import type { EvalPred, PredBase } from "./predicates";

/** Replace matched entries in adj, preserve the rest. */
export type MapAdj<Adj, P, NewEntry extends NodeEntry<string, string[], any>> = {
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
    ? NewEntry extends NodeEntry<any, any, infer NewO>
      ? NewO
      : O
    : O
  : O;

/** Union of entry types that match the predicate. */
export type MatchingEntries<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? Adj[K]
      : never
    : never;
}[keyof Adj];

/**
 * Check that NewEntry's output type extends all matched entries' output types.
 * Returns `true` if safe, `false` if any matched entry has an incompatible output.
 */
type MapTypeSafe<Adj, P, NewEntry extends NodeEntry<string, string[], any>> =
  NewEntry extends NodeEntry<any, any, infer NO>
    ? MatchingEntries<Adj, P> extends NodeEntry<any, any, infer MO>
      ? NO extends MO
        ? true
        : false
      : true // no matches = safe
    : false;

/** Branded error type for type-unsafe maps. Not assignable to NExpr or DirtyExpr. */
export interface MapTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __mapTypeError: _Msg;
}

/**
 * Transform matching nodes using a mapping function. Returns DirtyExpr.
 *
 * Type-safe: returns `MapTypeError` at compile time if the callback's
 * output type doesn't match the matched nodes' output type.
 *
 * Accepts both NExpr and DirtyExpr as input for chaining.
 */
export function mapWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewEntry extends NodeEntry<string, string[], any>,
>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  pred: P,
  fn: (entry: MatchingEntries<Adj, P>) => NewEntry,
): MapTypeSafe<Adj, P, NewEntry> extends true
  ? DirtyExpr<MapOut<O, Adj, R, P, NewEntry>, R, MapAdj<Adj, P, NewEntry>, C>
  : MapTypeError<"callback output type does not match matched node output type"> {
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      newAdj[id] = fn(entry as MatchingEntries<Adj, P>);
    } else {
      newAdj[id] = entry;
    }
  }
  return { __id: expr.__id, __adj: newAdj, __counter: expr.__counter } as any;
}
