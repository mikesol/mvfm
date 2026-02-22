/**
 * Replace — kind substitution convenience.
 *
 * replaceWhere is a thin wrapper over mapWhere that swaps only the
 * kind string while preserving children and output.
 *
 * Returns DirtyExpr requiring explicit commit() before fold.
 */

import type { DirtyExpr } from "./dirty";
import type { NExpr, NodeEntry } from "./expr";
import type { MapAdj, MapOut, MatchingEntries } from "./map";
import { mapWhere } from "./map";
import type { PredBase } from "./predicates";

/** Swap the kind of a matching entry, preserving children and out. */
type ReplaceKind<Entry, NewKind extends string> =
  Entry extends NodeEntry<any, infer C extends string[], infer O>
    ? NodeEntry<NewKind, C, O>
    : never;

/** Replace the kind of all matching nodes. Returns DirtyExpr. */
export function replaceWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  NewKind extends string,
>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  pred: P,
  newKind: NewKind,
): DirtyExpr<
  MapOut<O, Adj, R, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  R,
  MapAdj<Adj, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
  C
> {
  return mapWhere(expr, pred, (entry: any) => ({
    kind: newKind,
    children: entry.children,
    out: entry.out,
  })) as any;
}
