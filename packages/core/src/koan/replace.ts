import type { DirtyExpr } from "./dirty";
import type { NExpr, NodeEntry } from "./expr";
import type { MapAdj, MapOut, MatchingEntries } from "./map";
import { mapWhere } from "./map";
import type { PredBase } from "./predicates";

type ReplaceKind<Entry, NewKind extends string> =
  Entry extends NodeEntry<string, infer C extends string[], infer O>
    ? NodeEntry<NewKind, C, O>
    : never;

/** Replace matched node kinds while preserving children and output payloads. */
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
  return mapWhere(expr, pred, (entry) => {
    const node = entry as unknown as NodeEntry<string, string[], unknown>;
    return {
      kind: newKind,
      children: node.children,
      out: node.out,
    };
  }) as DirtyExpr<
    MapOut<O, Adj, R, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
    R,
    MapAdj<Adj, P, ReplaceKind<MatchingEntries<Adj, P>, NewKind>>,
    C
  >;
}
