/**
 * Select — runtime node selection via predicates.
 *
 * selectWhere returns a typed Set of node IDs matching a predicate,
 * with type-level SelectKeys tracking which keys are included.
 */

import type { NExpr } from "./expr";
import type { PredBase, SelectKeys } from "./predicates";

/** Select all node IDs in an NExpr that match a predicate. */
export function selectWhere<O, R extends string, Adj, C extends string, P extends PredBase>(
  expr: NExpr<O, R, Adj, C>,
  pred: P,
): Set<string & SelectKeys<Adj, P>> {
  const result = new Set<string>();
  for (const [id, entry] of Object.entries(expr.__adj)) {
    if (pred.test(entry, id, expr.__adj)) {
      result.add(id);
    }
  }
  return result as Set<string & SelectKeys<Adj, P>>;
}
