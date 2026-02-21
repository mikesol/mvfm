import type { DirtyExpr } from "./dirty";
import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import type { EvalPred, PredBase } from "./predicates";

/** Replace matched adjacency entries with NewEntry; preserve non-matching entries. */
export type MapAdj<Adj, P, NewEntry extends NodeEntry<string, string[], unknown>> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? NewEntry
      : Adj[K]
    : Adj[K];
};

/** Output type after mapping root entry if predicate matches root. */
export type MapOut<
  O,
  Adj,
  RootID extends string,
  P,
  NewEntry extends NodeEntry<string, string[], unknown>,
> = RootID extends keyof Adj
  ? EvalPred<P, Adj[RootID & keyof Adj], RootID, Adj> extends true
    ? NewEntry extends NodeEntry<string, string[], infer NewOut>
      ? NewOut
      : O
    : O
  : O;

/** Union of entries in Adj matched by predicate P. */
export type MatchingEntries<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? Adj[K]
      : never
    : never;
}[keyof Adj];

/**
 * Check that NewEntry output type extends all matched entries' output types.
 * Returns true when safe (or no matches), false on any mismatch.
 */
export type MapTypeSafe<Adj, P, NewEntry extends NodeEntry<string, string[], unknown>> = keyof {
  [K in keyof Adj as K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? Adj[K] extends NodeEntry<string, string[], infer MO>
        ? NewEntry extends NodeEntry<string, string[], infer NO>
          ? NO extends MO
            ? never
            : K
          : K
        : K
      : never
    : never]: true;
} extends never
  ? true
  : false;

/** Branded error type for type-unsafe maps. */
export interface MapTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __mapTypeError: _Msg;
}

/** Map matching entries with a typed callback while preserving program identity/counter. */
export function mapWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewEntry extends NodeEntry<string, string[], unknown>,
>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  pred: P,
  fn: (entry: MatchingEntries<Adj, P>) => NewEntry,
): MapTypeSafe<Adj, P, NewEntry> extends true
  ? DirtyExpr<MapOut<O, Adj, R, P, NewEntry>, R, MapAdj<Adj, P, NewEntry>, C>
  : MapTypeError<"callback output type does not match matched node output type"> {
  const mapped: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    mapped[id] = pred.test(entry, id, expr.__adj)
      ? (fn(entry as MatchingEntries<Adj, P>) as RuntimeEntry)
      : entry;
  }
  return {
    __id: expr.__id,
    __adj: mapped,
    __counter: expr.__counter,
  } as unknown as MapTypeSafe<Adj, P, NewEntry> extends true
    ? DirtyExpr<MapOut<O, Adj, R, P, NewEntry>, R, MapAdj<Adj, P, NewEntry>, C>
    : MapTypeError<"callback output type does not match matched node output type">;
}
