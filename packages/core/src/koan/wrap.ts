import type { DirtyExpr, RewireAdj } from "./dirty";
import { makeNExpr, type NExpr, type NodeEntry, type RuntimeEntry } from "./expr";
import type { Increment } from "./increment";
import { incrementId } from "./increment";

function rewriteOutRefs(value: unknown, targetId: string, wrapperId: string): unknown {
  if (typeof value === "string") return value === targetId ? wrapperId : value;
  if (Array.isArray(value)) return value.map((item) => rewriteOutRefs(item, targetId, wrapperId));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteOutRefs(v, targetId, wrapperId);
    return out;
  }
  return value;
}

type TargetOut<Adj, Id extends string> = Id extends keyof Adj
  ? Adj[Id] extends NodeEntry<string, string[], infer O>
    ? O
    : unknown
  : unknown;

/** Rewired parents plus inserted wrapper entry. */
export type WrapOneResult<
  Adj,
  TargetID extends string,
  WrapperKind extends string,
  WrapperID extends string,
> = RewireAdj<Adj, TargetID, WrapperID> &
  Record<WrapperID, NodeEntry<WrapperKind, [TargetID], TargetOut<Adj, TargetID>>>;

type WrapRoot<
  R extends string,
  TargetID extends string,
  WrapperID extends string,
> = R extends TargetID ? WrapperID : R;

/** Insert wrapper node above target id and rewire all parents to wrapper id. */
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
  const nextAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    nextAdj[id] = {
      ...entry,
      children: entry.children.map((c) => (c === targetId ? wrapperId : c)),
      out:
        entry.kind === "core/record" || entry.kind === "core/tuple"
          ? rewriteOutRefs(entry.out, targetId, wrapperId)
          : entry.out,
    };
  }
  nextAdj[wrapperId] = { kind: wrapperKind, children: [targetId], out: targetEntry?.out };
  const nextRoot = expr.__id === targetId ? wrapperId : expr.__id;
  return makeNExpr(
    nextRoot as WrapRoot<R, TargetID, C>,
    nextAdj,
    nextCounter as Increment<C>,
  ) as unknown as DirtyExpr<
    O,
    WrapRoot<R, TargetID, C>,
    WrapOneResult<Adj, TargetID, WrapperKind, C>,
    Increment<C>
  >;
}
