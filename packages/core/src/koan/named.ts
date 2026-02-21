import type { DirtyAdjOf, DirtyExpr } from "./dirty";
import { makeNExpr, type NExpr, type NodeEntry } from "./expr";
import { type LiveAdj, liveAdj } from "./gc";

/** Alias entry type keyed as `@name` in adjacency. */
export type NameAlias<_Name extends string, TargetID extends string, Out> = NodeEntry<
  "@alias",
  [TargetID],
  Out
>;

type TargetOut<Adj, ID extends string> = ID extends keyof Adj
  ? Adj[ID] extends NodeEntry<string, string[], infer O>
    ? O
    : unknown
  : unknown;

/** Add alias entry `@name -> targetId` without consuming counter. */
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
  return makeNExpr(
    expr.__id as R,
    {
      ...expr.__adj,
      [`@${n}`]: { kind: "@alias", children: [targetId], out: targetEntry?.out },
    },
    expr.__counter as C,
  ) as NExpr<O, R, Adj & Record<`@${N}`, NameAlias<N, T, TargetOut<Adj, T>>>, C>;
}

/** Preserve only alias keys (`@...`) from adjacency. */
export type PreserveAliases<Adj> = {
  [K in keyof Adj as K extends `@${string}` ? K : never]: Adj[K];
};

/** GC variant that retains alias entries even if unreachable from root. */
export function gcPreservingAliases<O, R extends string, Adj, C extends string>(
  d: DirtyExpr<O, R, Adj, C>,
): DirtyExpr<O, R, LiveAdj<Adj, R> & PreserveAliases<Adj>, C> {
  const live = liveAdj(d.__adj, d.__id);
  for (const [k, v] of Object.entries(d.__adj)) {
    if (k.startsWith("@")) live[k] = v;
  }
  return { __id: d.__id, __adj: live, __counter: d.__counter } as unknown as DirtyExpr<
    O,
    R,
    LiveAdj<Adj, R> & PreserveAliases<Adj>,
    C
  >;
}

/** Convenience helper for local typing checks against dirty results. */
export type NamedDirtyAdjOf<D> = DirtyAdjOf<D>;
