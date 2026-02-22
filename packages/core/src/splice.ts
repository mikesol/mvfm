/**
 * Splice — remove matched nodes and replace with their Nth child.
 *
 * SpliceAdj removes matched entries and reconnects surviving parents
 * to the child at index I of each spliced node. The index I is a
 * type-level number so the compiler can track arity and type changes.
 *
 * Type-safety: the replacement child's Out must extend the matched node's
 * Out, otherwise the splice would silently change the type flowing to the
 * parent. SpliceTypeSafe validates this and makes the return type `never`
 * when a mismatch is detected.
 */

import type { NExpr, NodeEntry, RuntimeEntry } from "./expr";
import { makeNExpr } from "./expr";
import type { PredBase, SelectKeys } from "./predicates";
import { extractChildIds } from "./structural-children";

/** Index into a tuple: `TupleAt<["a","b","c"], 1>` = `"b"`. */
type TupleAt<T extends string[], I extends number, Acc extends unknown[] = []> = T extends [
  infer H extends string,
  ...infer Rest extends string[],
]
  ? Acc["length"] extends I
    ? H
    : TupleAt<Rest, I, [...Acc, unknown]>
  : never;

/**
 * For each matched node, check that child[I]'s Out extends the matched node's Out.
 * Resolves to `true` if all are compatible, `false` if any mismatch.
 */
type SpliceTypeSafe<Adj, Matched extends string, I extends number> = keyof {
  [K in Matched & keyof Adj as Adj[K] extends {
    children: infer HC extends string[];
    out: infer MO;
  }
    ? TupleAt<HC, I> extends infer R extends string
      ? R extends keyof Adj
        ? Adj[R] extends { out: infer CO }
          ? CO extends MO
            ? never // compatible — filter out
            : K // mismatch — keep this key as evidence
          : K
        : K
      : K
    : K]: true;
} extends never
  ? true
  : false;

/** Replace each matched child with its Ith child. */
type SpliceAt<C extends string[], Adj, Matched extends string, I extends number> = C extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends Matched
    ? H extends keyof Adj
      ? Adj[H] extends { children: infer HC extends string[] }
        ? TupleAt<HC, I> extends infer R extends string
          ? [R, ...SpliceAt<T, Adj, Matched, I>]
          : SpliceAt<T, Adj, Matched, I>
        : SpliceAt<T, Adj, Matched, I>
      : SpliceAt<T, Adj, Matched, I>
    : [H, ...SpliceAt<T, Adj, Matched, I>]
  : [];

/** Remove matched nodes from adj, reconnect via child at index I. */
export type SpliceAdj<Adj, Matched extends string, I extends number = 0> = {
  [K in keyof Adj as K extends Matched ? never : K]: Adj[K] extends NodeEntry<
    infer Kind extends string,
    infer Ch extends string[],
    infer O
  >
    ? NodeEntry<Kind, SpliceAt<Ch, Adj, Matched, I>, O>
    : Adj[K];
};

/** If root is matched, take its Ith child as new root. */
type SpliceRoot<
  R extends string,
  Adj,
  Matched extends string,
  I extends number = 0,
> = R extends Matched
  ? R extends keyof Adj
    ? Adj[R] extends NodeEntry<any, infer HC extends string[], any>
      ? TupleAt<HC, I> extends infer First extends string
        ? First
        : R
      : R
    : R
  : R;

/** Branded error type for type-unsafe splices. Not assignable to NExpr. */
export interface SpliceTypeError<_Msg extends string = string> {
  readonly __brand: unique symbol;
  readonly __spliceTypeError: _Msg;
}

/**
 * Remove all nodes matching the predicate, replacing each with its child at index `I`.
 * `I` defaults to 0, meaning the first child is kept as the replacement.
 *
 * Type-safe: returns `SpliceTypeError` at compile time if the replacement child's
 * output type doesn't match the spliced node's output type.
 */
export function spliceWhere<
  O,
  R extends string,
  Adj,
  C extends string,
  P extends PredBase,
  I extends number = 0,
>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
  childIndex?: I,
): SpliceTypeSafe<Adj, SelectKeys<Adj, P>, I> extends true
  ? NExpr<O, SpliceRoot<R, Adj, SelectKeys<Adj, P>, I>, SpliceAdj<Adj, SelectKeys<Adj, P>, I>, C>
  : SpliceTypeError<"replacement child output type does not match spliced node output type"> {
  const idx = childIndex ?? (0 as number);
  const matched = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      matched.add(id);
    }
  }

  const newAdj: Record<string, RuntimeEntry> = {};
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (matched.has(id)) continue;
    newAdj[id] = {
      ...entry,
      children: rSplice(entry.children, expr.__adj, matched, idx) as string[],
    };
  }

  let newRoot = expr.__id;
  if (matched.has(newRoot)) {
    const rootEntry = expr.__adj[newRoot];
    const rootChildIds = extractChildIds(rootEntry?.children ?? []);
    if (rootChildIds.length > 0) {
      newRoot = rootChildIds[Math.min(idx, rootChildIds.length - 1)];
    }
  }

  return makeNExpr(newRoot, newAdj, expr.__counter) as any;
}

/**
 * Resolve a matched ID: return the single replacement ID at childIndex.
 * Recursively resolves if the chosen child is also matched.
 */
function resolveSpliceId(
  id: string,
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
  childIndex: number,
): string {
  if (!matched.has(id)) return id;
  const entry = adj[id];
  if (!entry) return id;
  const childIds = extractChildIds(entry.children);
  if (childIds.length === 0) return id;
  const picked = childIds[Math.min(childIndex, childIds.length - 1)];
  return resolveSpliceId(picked, adj, matched, childIndex);
}

/** Recursively resolve children through spliced nodes, handling structural children. */
function rSplice(
  children: unknown,
  adj: Record<string, RuntimeEntry>,
  matched: Set<string>,
  childIndex: number,
): unknown {
  if (typeof children === "string") {
    return resolveSpliceId(children, adj, matched, childIndex);
  }
  if (Array.isArray(children)) {
    return children.map((c) =>
      typeof c === "string"
        ? resolveSpliceId(c, adj, matched, childIndex)
        : rSplice(c, adj, matched, childIndex),
    );
  }
  if (typeof children === "object" && children !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(children)) {
      result[key] = rSplice(val, adj, matched, childIndex);
    }
    return result;
  }
  return children;
}
