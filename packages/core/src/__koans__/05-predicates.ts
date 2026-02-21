/**
 * Koan 04: Predicates — structured, type-level computable node matchers
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - 8 predicate types: KindPred, KindGlobPred, LeafPred, CountPred,
 *   NotPred, AndPred, OrPred, NamePred
 * - Each has a runtime constructor returning Pred & TypeTag
 * - EvalPred<P, Entry, ID, Adj> evaluates predicates at the type level
 *   NOTE: ID and Adj params are included from the start (no retrofit for NamePred)
 * - SelectKeys<Adj, P> computes the set of matching keys
 * - Combinators compose: and(byKindGlob("num/"), not(isLeaf())) works
 * - NamePred looks up @Name alias in Adj to resolve target ID
 *
 * Design decision:
 * - EvalPred takes ID + Adj from day one because NamePred needs them
 * - Default params (ID = string, Adj = Record<string, any>) keep
 *   non-name predicates backward compatible
 *
 * Imports: 03-normalize (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/04-predicates.ts
 */

export * from "./04-normalize";

import type { NodeEntry, RuntimeEntry } from "./04-normalize";

// ─── Runtime predicate interface ─────────────────────────────────────
export interface PredBase {
  test(
    entry: RuntimeEntry,
    id: string,
    adj: Record<string, RuntimeEntry>,
  ): boolean;
}

// ─── 8 predicate type tags ───────────────────────────────────────────
export interface KindPred<K extends string> extends PredBase {
  readonly _tag: "kind"; readonly kind: K;
}
export interface KindGlobPred<P extends string> extends PredBase {
  readonly _tag: "kindGlob"; readonly prefix: P;
}
export interface LeafPred extends PredBase {
  readonly _tag: "leaf";
}
export interface CountPred<N extends number> extends PredBase {
  readonly _tag: "count"; readonly count: N;
}
export interface NotPred<P extends PredBase> extends PredBase {
  readonly _tag: "not"; readonly pred: P;
}
export interface AndPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "and"; readonly left: A; readonly right: B;
}
export interface OrPred<A extends PredBase, B extends PredBase> extends PredBase {
  readonly _tag: "or"; readonly left: A; readonly right: B;
}
export interface NamePred<N extends string> extends PredBase {
  readonly _tag: "name"; readonly name: N;
}

// ─── EvalPred: type-level predicate evaluation ──────────────────────
export type EvalPred<
  P,
  Entry,
  ID extends string = string,
  Adj = Record<string, any>,
> = P extends KindPred<infer K>
  ? Entry extends NodeEntry<K, any, any> ? true : false
  : P extends KindGlobPred<infer Prefix>
    ? Entry extends NodeEntry<`${Prefix}${string}`, any, any> ? true : false
    : P extends LeafPred
      ? Entry extends NodeEntry<any, [], any> ? true : false
      : P extends CountPred<infer N>
        ? Entry extends NodeEntry<any, infer C extends string[], any>
          ? C["length"] extends N ? true : false
          : false
        : P extends NotPred<infer Inner>
          ? EvalPred<Inner, Entry, ID, Adj> extends true ? false : true
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
                  ? ID extends T ? true : false
                  : false
                : false;

// ─── SelectKeys: compute matching key union ──────────────────────────
export type SelectKeys<
  Adj,
  P,
> = {
  [K in keyof Adj]: K extends string
    ? EvalPred<P, Adj[K], K, Adj> extends true ? K : never
    : never;
}[keyof Adj];

// ─── Runtime constructors ────────────────────────────────────────────
export function byKind<K extends string>(kind: K): KindPred<K> {
  return { _tag: "kind", kind, test: (e) => e.kind === kind } as KindPred<K>;
}

export function byKindGlob<P extends string>(prefix: P): KindGlobPred<P> {
  return {
    _tag: "kindGlob", prefix,
    test: (e) => e.kind.startsWith(prefix),
  } as KindGlobPred<P>;
}

export function isLeaf(): LeafPred {
  return {
    _tag: "leaf",
    test: (e) => e.children.length === 0,
  } as LeafPred;
}

export function hasChildCount<N extends number>(count: N): CountPred<N> {
  return {
    _tag: "count", count,
    test: (e) => e.children.length === count,
  } as CountPred<N>;
}

export function not<P extends PredBase>(pred: P): NotPred<P> {
  return {
    _tag: "not", pred,
    test: (e, id, adj) => !pred.test(e, id, adj),
  } as NotPred<P>;
}

export function and<A extends PredBase, B extends PredBase>(
  left: A, right: B,
): AndPred<A, B> {
  return {
    _tag: "and", left, right,
    test: (e, id, adj) => left.test(e, id, adj) && right.test(e, id, adj),
  } as AndPred<A, B>;
}

export function or<A extends PredBase, B extends PredBase>(
  left: A, right: B,
): OrPred<A, B> {
  return {
    _tag: "or", left, right,
    test: (e, id, adj) => left.test(e, id, adj) || right.test(e, id, adj),
  } as OrPred<A, B>;
}

export function byName<N extends string>(name: N): NamePred<N> {
  return {
    _tag: "name", name,
    test: (_, id, adj) => {
      const alias = adj[`@${name}`];
      return alias != null && alias.children[0] === id;
    },
  } as NamePred<N>;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

import type { AdjOf, IdOf } from "./04-normalize";
import { numLit, add, mul, app } from "./04-normalize";

// Reference program: (3+4)*5 → normalized adj {a,b,c,d,e}
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
type PA = AdjOf<typeof prog>;

// --- byKind("num/add") matches "c" ---
type AddKeys = SelectKeys<PA, KindPred<"num/add">>;
const _addKey: AddKeys = "c";
// @ts-expect-error — "a" is not an add node
const _addKeyBad: AddKeys = "a";

// --- byKind("num/mul") matches "e" ---
type MulKeys = SelectKeys<PA, KindPred<"num/mul">>;
const _mulKey: MulKeys = "e";
// @ts-expect-error — "c" is not a mul node
const _mulKeyBad: MulKeys = "c";

// --- isLeaf() matches "a", "b", "d" ---
type LeafKeys = SelectKeys<PA, LeafPred>;
const _leafA: LeafKeys = "a";
const _leafB: LeafKeys = "b";
const _leafD: LeafKeys = "d";
// @ts-expect-error — "c" has children, not a leaf
const _leafBad: LeafKeys = "c";

// --- byKindGlob("num/") matches all 5 ---
type NumKeys = SelectKeys<PA, KindGlobPred<"num/">>;
const _numA: NumKeys = "a";
const _numE: NumKeys = "e";

// --- hasChildCount(2) matches "c" and "e" ---
type BinaryKeys = SelectKeys<PA, CountPred<2>>;
const _bin1: BinaryKeys = "c";
const _bin2: BinaryKeys = "e";
// @ts-expect-error — "a" has 0 children
const _binBad: BinaryKeys = "a";

// --- not(isLeaf()) matches "c" and "e" ---
type NonLeafKeys = SelectKeys<PA, NotPred<LeafPred>>;
const _nl1: NonLeafKeys = "c";
const _nl2: NonLeafKeys = "e";
// @ts-expect-error — "a" is a leaf
const _nlBad: NonLeafKeys = "a";

// --- and(byKindGlob("num/"), hasChildCount(2)) matches "c" and "e" ---
type AndKeys = SelectKeys<PA, AndPred<KindGlobPred<"num/">, CountPred<2>>>;
const _and1: AndKeys = "c";
const _and2: AndKeys = "e";
// @ts-expect-error — "a" is leaf
const _andBad: AndKeys = "a";

// --- or(byKind("num/add"), byKind("num/mul")) matches "c" and "e" ---
type OrKeys = SelectKeys<
  PA, OrPred<KindPred<"num/add">, KindPred<"num/mul">>
>;
const _or1: OrKeys = "c";
const _or2: OrKeys = "e";
// @ts-expect-error — "a" is neither add nor mul
const _orBad: OrKeys = "a";

// --- NamePred: manual adj with alias ---
type AdjWithAlias = {
  a: NodeEntry<"num/literal", [], number>;
  b: NodeEntry<"num/add", ["a"], number>;
  "@myname": NodeEntry<"@alias", ["a"], never>;
};
type NameKeys = SelectKeys<AdjWithAlias, NamePred<"myname">>;
const _nameKey: NameKeys = "a";
// @ts-expect-error — "b" is not the alias target
const _nameKeyBad: NameKeys = "b";

// --- Constructors produce the right types ---
const _bk = byKind("num/add");
const _bkg = byKindGlob("num/");
const _il = isLeaf();
const _hcc = hasChildCount(2);
const _nt = not(isLeaf());
const _ad = and(byKindGlob("num/"), hasChildCount(2));
const _o = or(byKind("num/add"), byKind("num/mul"));
const _bn = byName("test");

// Verify constructor return types carry the right tag
const _bkTag: typeof _bk._tag = "kind";
const _bkgTag: typeof _bkg._tag = "kindGlob";
const _ilTag: typeof _il._tag = "leaf";
const _hccTag: typeof _hcc._tag = "count";
const _ntTag: typeof _nt._tag = "not";
const _adTag: typeof _ad._tag = "and";
const _oTag: typeof _o._tag = "or";
const _bnTag: typeof _bn._tag = "name";
