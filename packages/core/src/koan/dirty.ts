import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";

declare const dirtyBrand: unique symbol;

type RemoveAdj<Adj, Id extends string> = {
  [K in keyof Adj as K extends Id ? never : K]: Adj[K];
};

type SwapAdj<Adj, Id extends string, E> = RemoveAdj<Adj, Id> & Record<Id, E>;

function rewriteOutRefs(value: unknown, oldRef: string, newRef: string): unknown {
  if (typeof value === "string") return value === oldRef ? newRef : value;
  if (Array.isArray(value)) return value.map((item) => rewriteOutRefs(item, oldRef, newRef));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteOutRefs(v, oldRef, newRef);
    return out;
  }
  return value;
}

/** Mutable transaction view over an NExpr graph. */
export interface DirtyExpr<O, RootId extends string, Adj, Ctr extends string> {
  readonly [dirtyBrand]: {
    readonly o: O;
    readonly rootId: RootId;
    readonly adj: Adj;
    readonly ctr: Ctr;
  };
  readonly __id: string;
  readonly __adj: Record<string, RuntimeEntry>;
  readonly __counter: string;
}

/** Extract dirty-root id. */
export type DirtyIdOf<D> = D extends DirtyExpr<any, infer R, any, any> ? R : never;
/** Extract dirty adjacency type. */
export type DirtyAdjOf<D> = D extends DirtyExpr<any, any, infer A, any> ? A : never;
/** Extract dirty counter id. */
export type DirtyCtrOf<D> = D extends DirtyExpr<any, any, any, infer C> ? C : never;
/** Extract dirty output type. */
export type DirtyOutOf<D> = D extends DirtyExpr<infer O, any, any, any> ? O : never;

/** Convert immutable NExpr to editable dirty view. */
export function dirty<O, R extends string, Adj, C extends string>(
  expr: NExpr<O, R, Adj, C>,
): DirtyExpr<O, R, Adj, C> {
  return {
    __id: expr.__id,
    __adj: { ...expr.__adj },
    __counter: expr.__counter,
  } as unknown as DirtyExpr<O, R, Adj, C>;
}

/** Add a new entry by id. */
export function addEntry<
  O,
  R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], unknown>,
>(d: DirtyExpr<O, R, Adj, C>, id: Id, entry: E): DirtyExpr<O, R, Adj & Record<Id, E>, C> {
  return {
    __id: d.__id,
    __adj: { ...d.__adj, [id]: entry },
    __counter: d.__counter,
  } as unknown as DirtyExpr<O, R, Adj & Record<Id, E>, C>;
}

/** Remove an entry by id. */
export function removeEntry<O, R extends string, Adj, C extends string, Id extends string>(
  d: DirtyExpr<O, R, Adj, C>,
  id: Id,
): DirtyExpr<O, R, RemoveAdj<Adj, Id>, C> {
  const next = { ...d.__adj };
  delete next[id];
  return { __id: d.__id, __adj: next, __counter: d.__counter } as unknown as DirtyExpr<
    O,
    R,
    RemoveAdj<Adj, Id>,
    C
  >;
}

/** Swap an entry at id with a replacement entry. */
export function swapEntry<
  O,
  R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], unknown>,
>(d: DirtyExpr<O, R, Adj, C>, id: Id, entry: E): DirtyExpr<O, R, SwapAdj<Adj, Id, E>, C> {
  return {
    __id: d.__id,
    __adj: { ...d.__adj, [id]: entry },
    __counter: d.__counter,
  } as unknown as DirtyExpr<O, R, SwapAdj<Adj, Id, E>, C>;
}

type RewireList<C extends string[], Old extends string, New extends string> = C extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? [H extends Old ? New : H, ...RewireList<T, Old, New>]
  : [];

/** Adjacency after global child-reference replacement. */
export type RewireAdj<Adj, Old extends string, New extends string> = {
  [K in keyof Adj]: Adj[K] extends NodeEntry<
    infer Kind extends string,
    infer C extends string[],
    infer O
  >
    ? NodeEntry<Kind, RewireList<C, Old, New>, O>
    : Adj[K];
};

/** Rewire every child reference from oldRef to newRef across the graph. */
export function rewireChildren<
  O,
  R extends string,
  Adj,
  C extends string,
  Old extends string,
  New extends string,
>(
  d: DirtyExpr<O, R, Adj, C>,
  oldRef: Old,
  newRef: New,
): DirtyExpr<O, R, RewireAdj<Adj, Old, New>, C> {
  const next: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(d.__adj)) {
    next[id] = {
      ...entry,
      children: entry.children.map((c) => (c === oldRef ? newRef : c)),
      out:
        entry.kind === "core/record" || entry.kind === "core/tuple"
          ? rewriteOutRefs(entry.out, oldRef, newRef)
          : entry.out,
    };
  }
  return { __id: d.__id, __adj: next, __counter: d.__counter } as unknown as DirtyExpr<
    O,
    R,
    RewireAdj<Adj, Old, New>,
    C
  >;
}

/** Change graph root id. */
export function setRoot<O, R extends string, Adj, C extends string, NewRoot extends string>(
  d: DirtyExpr<O, R, Adj, C>,
  newRootId: NewRoot,
): DirtyExpr<O, NewRoot, Adj, C> {
  return { __id: newRootId, __adj: d.__adj, __counter: d.__counter } as unknown as DirtyExpr<
    O,
    NewRoot,
    Adj,
    C
  >;
}
