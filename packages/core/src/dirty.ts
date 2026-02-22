/**
 * Dirty — mutable transaction primitives.
 *
 * DirtyExpr is phantom-branded separately from NExpr to prevent
 * accidental use of uncommitted data. Provides typed add, remove,
 * swap, rewire, and setRoot operations.
 *
 * Type-safety: RewireTypeSafe and SwapTypeSafe verify that output types
 * are preserved when rewiring or swapping entries. Returns branded error
 * types (not assignable to DirtyExpr) on mismatch.
 */

import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import { remapChildren } from "./structural-children";

/** Unique brand preventing DirtyExpr from being used as NExpr. */
declare const dirtyBrand: unique symbol;

/** Mutable transaction state, structurally incompatible with NExpr. */
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

/** Extract the root ID from a DirtyExpr. */
export type DirtyIdOf<D> = D extends DirtyExpr<any, infer R, any, any> ? R : never;

/** Extract the adjacency map type from a DirtyExpr. */
export type DirtyAdjOf<D> = D extends DirtyExpr<any, any, infer A, any> ? A : never;

/** Extract the counter state from a DirtyExpr. */
export type DirtyCtrOf<D> = D extends DirtyExpr<any, any, any, infer C> ? C : never;

/** Extract the output type from a DirtyExpr. */
export type DirtyOutOf<D> = D extends DirtyExpr<infer O, any, any, any> ? O : never;

/** Convert an NExpr into a mutable DirtyExpr for editing. */
export function dirty<O, R extends string, Adj, C extends string>(
  expr: NExpr<O, R, Adj, C>,
): DirtyExpr<O, R, Adj, C> {
  return {
    __id: expr.__id,
    __adj: { ...expr.__adj },
    __counter: expr.__counter,
  } as unknown as DirtyExpr<O, R, Adj, C>;
}

/** Add a new entry to the adjacency map. */
export function addEntry<
  O,
  R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], any>,
>(d: DirtyExpr<O, R, Adj, C>, id: Id, entry: E): DirtyExpr<O, R, Adj & Record<Id, E>, C> {
  const newAdj = { ...d.__adj, [id]: entry };
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

/** Remove an entry from the adjacency map. */
export function removeEntry<O, R extends string, Adj, C extends string, Id extends string>(
  d: DirtyExpr<O, R, Adj, C>,
  id: Id,
): DirtyExpr<O, R, { [K in keyof Adj as K extends Id ? never : K]: Adj[K] }, C> {
  const newAdj = { ...d.__adj };
  delete newAdj[id];
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── SwapTypeSafe ────────────────────────────────────────────────────

/**
 * Check that NewEntry's output extends the existing entry's output at Id.
 * New entries (Id not in Adj) are unconstrained.
 */
type SwapTypeSafe<
  Adj,
  Id extends string,
  E extends NodeEntry<string, string[], any>,
> = Id extends keyof Adj
  ? E extends NodeEntry<any, any, infer NO>
    ? Adj[Id] extends { out: infer OO }
      ? NO extends OO
        ? true
        : false
      : true
    : false
  : true; // new entry, no constraint

/** Branded error type for type-unsafe swaps. Not assignable to DirtyExpr. */
export interface SwapTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __swapTypeError: _Msg;
}

/**
 * Replace an entry in the adjacency map.
 *
 * Type-safe: returns `SwapTypeError` at compile time if the new entry's
 * output type doesn't match the existing entry's output type.
 */
export function swapEntry<
  O,
  R extends string,
  Adj,
  C extends string,
  Id extends string,
  E extends NodeEntry<string, string[], any>,
>(
  d: DirtyExpr<O, R, Adj, C>,
  id: Id,
  entry: E,
): SwapTypeSafe<Adj, Id, E> extends true
  ? DirtyExpr<O, R, { [K in keyof Adj as K extends Id ? never : K]: Adj[K] } & Record<Id, E>, C>
  : SwapTypeError<"new entry output type does not match existing entry output type"> {
  const newAdj = { ...d.__adj, [id]: entry };
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

// ─── RewireTypeSafe ──────────────────────────────────────────────────

/** Type-level child list rewiring. */
type RewireList<C extends string[], Old extends string, New extends string> = C extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? [H extends Old ? New : H, ...RewireList<T, Old, New>]
  : [];

/** Type-level adjacency map rewiring. */
export type RewireAdj<Adj, Old extends string, New extends string> = {
  [K in keyof Adj]: Adj[K] extends NodeEntry<
    infer Kind extends string,
    infer C extends string[],
    infer O
  >
    ? NodeEntry<Kind, RewireList<C, Old, New>, O>
    : Adj[K];
};

/**
 * Check that the new ref's output extends the old ref's output.
 * If oldRef is not in Adj (no-op rewire), it's safe.
 */
type RewireTypeSafe<Adj, Old extends string, New extends string> = Old extends keyof Adj
  ? New extends keyof Adj
    ? Adj[New] extends { out: infer NO }
      ? Adj[Old] extends { out: infer OO }
        ? NO extends OO
          ? true
          : false
        : true
      : false
    : false // newRef not in adj
  : true; // oldRef not in adj = no-op

/** Branded error type for type-unsafe rewires. Not assignable to DirtyExpr. */
export interface RewireTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __rewireTypeError: _Msg;
}

/**
 * Replace all references to oldRef with newRef in children arrays.
 *
 * Type-safe: returns `RewireTypeError` at compile time if the new ref's
 * output type doesn't match the old ref's output type.
 */
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
): RewireTypeSafe<Adj, Old, New> extends true
  ? DirtyExpr<O, R, RewireAdj<Adj, Old, New>, C>
  : RewireTypeError<"new ref output type does not match old ref output type"> {
  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(d.__adj)) {
    newAdj[id] = {
      ...entry,
      children: remapChildren(entry.children, oldRef, newRef) as string[],
    };
  }
  return { __id: d.__id, __adj: newAdj, __counter: d.__counter } as any;
}

/** Change the root node ID. */
export function setRoot<O, R extends string, Adj, C extends string, NewRoot extends string>(
  d: DirtyExpr<O, R, Adj, C>,
  newRootId: NewRoot,
): DirtyExpr<O, NewRoot, Adj, C> {
  return {
    __id: newRootId,
    __adj: d.__adj,
    __counter: d.__counter,
  } as any;
}
