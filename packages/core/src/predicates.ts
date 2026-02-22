/**
 * Predicates — structured, type-level computable node matchers.
 *
 * 8 predicate types with runtime constructors and type-level evaluation.
 * EvalPred evaluates predicates at the type level. SelectKeys computes
 * the set of matching adjacency map keys.
 */

import type { NodeEntry, RuntimeEntry } from "./expr";

// ─── Runtime predicate interface ─────────────────────────────────────

/** Base interface for all predicates with a runtime test method. */
export interface PredBase {
  test(entry: RuntimeEntry, id: string, adj: Record<string, RuntimeEntry>): boolean;
}

// ─── 8 predicate type tags ───────────────────────────────────────────

/** Matches nodes with an exact kind string. */
export interface KindPred<K extends string> extends PredBase {
  readonly _tag: "kind";
  readonly kind: K;
}

/** Matches nodes whose kind starts with a prefix. */
export interface KindGlobPred<P extends string> extends PredBase {
  readonly _tag: "kindGlob";
  readonly prefix: P;
}

/** Matches leaf nodes (zero children). */
export interface LeafPred extends PredBase {
  readonly _tag: "leaf";
}

/** Matches nodes with exactly N children. */
export interface CountPred<N extends number> extends PredBase {
  readonly _tag: "count";
  readonly count: N;
}

/** Negates a predicate. */
export interface NotPred<P extends PredBase> extends PredBase {
  readonly _tag: "not";
  readonly pred: P;
}

/** Logical AND of two predicates. */
export interface AndPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "and";
  readonly left: A;
  readonly right: B;
}

/** Logical OR of two predicates. */
export interface OrPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "or";
  readonly left: A;
  readonly right: B;
}

/** Matches nodes referenced by a named alias (@Name) in the adjacency map. */
export interface NamePred<N extends string> extends PredBase {
  readonly _tag: "name";
  readonly name: N;
}

// ─── EvalPred: type-level predicate evaluation ──────────────────────

/** Evaluates a predicate against a node entry at the type level. */
export type EvalPred<P, Entry, ID extends string = string, Adj = Record<string, any>> =
  P extends KindPred<infer K>
    ? Entry extends NodeEntry<K, any, any>
      ? true
      : false
    : P extends KindGlobPred<infer Prefix>
      ? Entry extends NodeEntry<`${Prefix}${string}`, any, any>
        ? true
        : false
      : P extends LeafPred
        ? Entry extends NodeEntry<any, [], any>
          ? true
          : false
        : P extends CountPred<infer N>
          ? Entry extends NodeEntry<any, infer C extends string[], any>
            ? C["length"] extends N
              ? true
              : false
            : false
          : P extends NotPred<infer Inner>
            ? EvalPred<Inner, Entry, ID, Adj> extends true
              ? false
              : true
            : P extends AndPred<infer A, infer B>
              ? EvalPred<A, Entry, ID, Adj> extends true
                ? EvalPred<B, Entry, ID, Adj>
                : false
              : P extends OrPred<infer A, infer B>
                ? EvalPred<A, Entry, ID, Adj> extends true
                  ? true
                  : EvalPred<B, Entry, ID, Adj>
                : P extends NamePred<infer N>
                  ? Adj extends Record<
                      `@${N}`,
                      NodeEntry<any, [infer T extends string, ...any[]], any>
                    >
                    ? ID extends T
                      ? true
                      : false
                    : false
                  : false;

// ─── SelectKeys: compute matching key union ──────────────────────────

/** Computes the union of adjacency map keys where the predicate holds. */
export type SelectKeys<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? K
      : never
    : never;
}[keyof Adj];

// ─── Runtime constructors ────────────────────────────────────────────

/** Create a predicate matching an exact node kind. */
export function byKind<K extends string>(kind: K): KindPred<K> {
  return { _tag: "kind", kind, test: (e) => e.kind === kind } as KindPred<K>;
}

/** Create a predicate matching node kinds starting with a prefix. */
export function byKindGlob<P extends string>(prefix: P): KindGlobPred<P> {
  return {
    _tag: "kindGlob",
    prefix,
    test: (e) => e.kind.startsWith(prefix),
  } as KindGlobPred<P>;
}

/** Create a predicate matching leaf nodes (zero children). */
export function isLeaf(): LeafPred {
  return {
    _tag: "leaf",
    test: (e) => e.children.length === 0,
  } as LeafPred;
}

/** Create a predicate matching nodes with exactly N children. */
export function hasChildCount<N extends number>(count: N): CountPred<N> {
  return {
    _tag: "count",
    count,
    test: (e) => e.children.length === count,
  } as CountPred<N>;
}

/** Negate a predicate. */
export function not<P extends PredBase>(pred: P): NotPred<P> {
  return {
    _tag: "not",
    pred,
    test: (e, id, adj) => !pred.test(e, id, adj),
  } as NotPred<P>;
}

/** Logical AND of two predicates. */
export function and<A extends PredBase, B extends PredBase>(left: A, right: B): AndPred<A, B> {
  return {
    _tag: "and",
    left,
    right,
    test: (e, id, adj) => left.test(e, id, adj) && right.test(e, id, adj),
  } as AndPred<A, B>;
}

/** Logical OR of two predicates. */
export function or<A extends PredBase, B extends PredBase>(left: A, right: B): OrPred<A, B> {
  return {
    _tag: "or",
    left,
    right,
    test: (e, id, adj) => left.test(e, id, adj) || right.test(e, id, adj),
  } as OrPred<A, B>;
}

/** Create a predicate matching nodes referenced by a named alias. */
export function byName<N extends string>(name: N): NamePred<N> {
  return {
    _tag: "name",
    name,
    test: (_, id, adj) => {
      const alias = adj[`@${name}`];
      return alias != null && alias.children[0] === id;
    },
  } as NamePred<N>;
}
