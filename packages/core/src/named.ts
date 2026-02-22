/**
 * Named — alias nodes and name-based operations.
 *
 * NameAlias is a metadata entry keyed as "@Name" in the adjacency map.
 * name() adds aliases without consuming a counter. gcPreservingAliases
 * keeps alias entries alive through garbage collection.
 */

import type { DirtyExpr } from "./dirty";
import type { NExpr, NodeEntry } from "./expr";
import { makeNExpr } from "./expr";
import type { LiveAdj } from "./gc";
import { liveAdj } from "./gc";

/** A name alias entry keyed as "@Name" pointing to a target node. */
export type NameAlias<_Name extends string, TargetID extends string, Out> = NodeEntry<
  "@alias",
  [TargetID],
  Out
>;

/** Extract output type of target node. */
type TargetOut<Adj, ID extends string> = ID extends keyof Adj
  ? Adj[ID] extends NodeEntry<any, any, infer O>
    ? O
    : unknown
  : unknown;

/** Add a named alias to the adjacency map without consuming a counter. */
export function name<
  O,
  R extends string,
  Adj,
  C extends string,
  N extends string,
  T extends string,
>(
  expr: NExpr<O, R, Adj, C>,
  n: N,
  targetId: T,
): NExpr<O, R, Adj & Record<`@${N}`, NameAlias<N, T, TargetOut<Adj, T>>>, C> {
  const targetEntry = expr.__adj[targetId];
  const newAdj = {
    ...expr.__adj,
    [`@${n}`]: {
      kind: "@alias",
      children: [targetId],
      out: targetEntry ? targetEntry.out : undefined,
    },
  };
  return makeNExpr(expr.__id, newAdj, expr.__counter) as any;
}

/** Extract only @-prefixed keys from an adjacency map. */
export type PreserveAliases<Adj> = {
  [K in keyof Adj as K extends `@${string}` ? K : never]: Adj[K];
};

/** Garbage collect while preserving alias entries. */
export function gcPreservingAliases<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): DirtyExpr<O, R, LiveAdj<Adj, R> & PreserveAliases<Adj>, C> {
  const live = liveAdj(d.__adj, d.__id);
  for (const [k, v] of Object.entries(d.__adj)) {
    if (k.startsWith("@")) live[k] = v;
  }
  return { __id: d.__id, __adj: live, __counter: d.__counter } as any;
}
