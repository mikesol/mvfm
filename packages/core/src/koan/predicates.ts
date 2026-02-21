import type { NodeEntry, RuntimeEntry } from "./expr";

/** Base runtime predicate interface for normalized entries. */
export interface PredBase {
  test(entry: RuntimeEntry, id: string, adj: Record<string, RuntimeEntry>): boolean;
}

/** Match exact node kind. */
export interface KindPred<K extends string> extends PredBase {
  readonly _tag: "kind";
  readonly kind: K;
}
/** Match node kind prefix. */
export interface KindGlobPred<P extends string> extends PredBase {
  readonly _tag: "kindGlob";
  readonly prefix: P;
}
/** Match leaf nodes. */
export interface LeafPred extends PredBase {
  readonly _tag: "leaf";
}
/** Match nodes by child count. */
export interface CountPred<N extends number> extends PredBase {
  readonly _tag: "count";
  readonly count: N;
}
/** Negation predicate. */
export interface NotPred<P extends PredBase> extends PredBase {
  readonly _tag: "not";
  readonly pred: P;
}
/** Conjunction predicate. */
export interface AndPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "and";
  readonly left: A;
  readonly right: B;
}
/** Disjunction predicate. */
export interface OrPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "or";
  readonly left: A;
  readonly right: B;
}
/** Alias-target predicate using `@name` entries. */
export interface NamePred<N extends string> extends PredBase {
  readonly _tag: "name";
  readonly name: N;
}

/** Type-level predicate evaluation against a node entry. */
export type EvalPred<P, Entry, ID extends string = string, Adj = Record<string, never>> =
  P extends KindPred<infer K>
    ? Entry extends NodeEntry<K, string[], unknown>
      ? true
      : false
    : P extends KindGlobPred<infer Prefix>
      ? Entry extends NodeEntry<`${Prefix}${string}`, string[], unknown>
        ? true
        : false
      : P extends LeafPred
        ? Entry extends NodeEntry<string, [], unknown>
          ? true
          : false
        : P extends CountPred<infer N>
          ? Entry extends NodeEntry<string, infer C extends string[], unknown>
            ? C["length"] extends N
              ? true
              : false
            : false
          : P extends NotPred<infer Inner extends PredBase>
            ? EvalPred<Inner, Entry, ID, Adj> extends true
              ? false
              : true
            : P extends AndPred<infer A extends PredBase, infer B extends PredBase>
              ? EvalPred<A, Entry, ID, Adj> extends true
                ? EvalPred<B, Entry, ID, Adj>
                : false
              : P extends OrPred<infer A extends PredBase, infer B extends PredBase>
                ? EvalPred<A, Entry, ID, Adj> extends true
                  ? true
                  : EvalPred<B, Entry, ID, Adj>
                : P extends NamePred<infer N>
                  ? Adj extends Record<
                      `@${N}`,
                      NodeEntry<string, [infer T extends string, ...string[]], unknown>
                    >
                    ? ID extends T
                      ? true
                      : false
                    : false
                  : false;

/** Key union selected by predicate P over adjacency Adj. */
export type SelectKeys<Adj, P> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true
      ? K
      : never
    : never;
}[keyof Adj];

/** Predicate constructor: exact kind match. */
export function byKind<K extends string>(kind: K): KindPred<K> {
  return { _tag: "kind", kind, test: (e) => e.kind === kind } as KindPred<K>;
}

/** Predicate constructor: kind prefix match. */
export function byKindGlob<P extends string>(prefix: P): KindGlobPred<P> {
  return {
    _tag: "kindGlob",
    prefix,
    test: (e) => e.kind.startsWith(prefix),
  } as KindGlobPred<P>;
}

/** Predicate constructor: leaves only. */
export function isLeaf(): LeafPred {
  return { _tag: "leaf", test: (e) => e.children.length === 0 } as LeafPred;
}

/** Predicate constructor: exact child count. */
export function hasChildCount<N extends number>(count: N): CountPred<N> {
  return { _tag: "count", count, test: (e) => e.children.length === count } as CountPred<N>;
}

/** Predicate constructor: logical not. */
export function not<P extends PredBase>(pred: P): NotPred<P> {
  return { _tag: "not", pred, test: (e, id, adj) => !pred.test(e, id, adj) } as NotPred<P>;
}

/** Predicate constructor: logical and. */
export function and<A extends PredBase, B extends PredBase>(left: A, right: B): AndPred<A, B> {
  return {
    _tag: "and",
    left,
    right,
    test: (e, id, adj) => left.test(e, id, adj) && right.test(e, id, adj),
  } as AndPred<A, B>;
}

/** Predicate constructor: logical or. */
export function or<A extends PredBase, B extends PredBase>(left: A, right: B): OrPred<A, B> {
  return {
    _tag: "or",
    left,
    right,
    test: (e, id, adj) => left.test(e, id, adj) || right.test(e, id, adj),
  } as OrPred<A, B>;
}

/** Predicate constructor: match alias target referenced by `@name`. */
export function byName<N extends string>(name: N): NamePred<N> {
  return {
    _tag: "name",
    name,
    test: (_e, id, adj) => {
      const alias = adj[`@${name}`];
      return alias != null && alias.children[0] === id;
    },
  } as NamePred<N>;
}
