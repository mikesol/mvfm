/**
 * Wrap — insert wrapper node above a target by ID.
 *
 * wrapByName inserts a new node between a target and all its parents.
 * The wrapper gets the target's output type and the next counter ID.
 * Critical: the wrapper itself must NOT have its child rewired to itself.
 *
 * Returns DirtyExpr requiring explicit commit() before fold.
 */

import type { DirtyExpr, RewireAdj } from "./dirty";
import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import type { Increment } from "./increment";
import { incrementId } from "./increment";
import { remapChildren } from "./structural-children";

/** Extract output type of a target node from the adjacency map. */
type TargetOut<Adj, ID extends string> = ID extends keyof Adj
  ? Adj[ID] extends NodeEntry<any, any, infer O>
    ? O
    : unknown
  : unknown;

/** Rewire parents: substitute targetId with wrapperId in all children. */
export type RewireParents<Adj, TargetID extends string, WrapperID extends string> = RewireAdj<
  Adj,
  TargetID,
  WrapperID
>;

/** Full adjacency map after wrapping: rewired adj + new wrapper entry. */
export type WrapOneResult<
  Adj,
  TargetID extends string,
  WrapperKind extends string,
  WrapperID extends string,
> = RewireParents<Adj, TargetID, WrapperID> &
  Record<WrapperID, NodeEntry<WrapperKind, [TargetID], TargetOut<Adj, TargetID>>>;

/** Compute new root: if target is root, wrapper becomes root. */
type WrapRoot<
  R extends string,
  TargetID extends string,
  WrapperID extends string,
> = R extends TargetID ? WrapperID : R;

/** Insert a wrapper node above the target. Returns DirtyExpr. */
export function wrapByName<
  O,
  R extends string,
  Adj,
  C extends string,
  TargetID extends string,
  WrapperKind extends string,
>(
  expr: NExpr<O, R, Adj, C> | DirtyExpr<O, R, Adj, C>,
  targetId: TargetID,
  wrapperKind: WrapperKind,
): DirtyExpr<
  O,
  WrapRoot<R, TargetID, C>,
  WrapOneResult<Adj, TargetID, WrapperKind, C>,
  Increment<C>
> {
  const wrapperId = expr.__counter;
  const nextCounter = incrementId(wrapperId);
  const targetEntry = expr.__adj[targetId];

  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    newAdj[id] = {
      ...entry,
      children: remapChildren(entry.children, targetId, wrapperId) as string[],
    };
  }

  newAdj[wrapperId] = {
    kind: wrapperKind,
    children: [targetId],
    out: targetEntry.out,
  };

  const newRoot = expr.__id === targetId ? wrapperId : expr.__id;
  return {
    __id: newRoot,
    __adj: newAdj,
    __counter: nextCounter,
  } as any;
}
