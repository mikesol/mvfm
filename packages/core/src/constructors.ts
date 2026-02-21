/**
 * Constructors — permissive builder functions for CExpr nodes.
 *
 * Each constructor creates a CExpr tagged with its node kind.
 * Literal constructors (numLit, strLit, boolLit) pass through raw values
 * since literals are lifted during normalization, not at construction time.
 */

import { type CExpr, makeCExpr } from "./expr";

// ─── Arithmetic constructors ────────────────────────────────────────

/** Create an addition expression. */
export function add<A, B>(a: A, b: B): CExpr<number, "num/add", [A, B]> {
  return makeCExpr<number, "num/add", [A, B]>("num/add", [a, b]);
}

/** Create a multiplication expression. */
export function mul<A, B>(a: A, b: B): CExpr<number, "num/mul", [A, B]> {
  return makeCExpr<number, "num/mul", [A, B]>("num/mul", [a, b]);
}

/** Create a subtraction expression. */
export function sub<A, B>(a: A, b: B): CExpr<number, "num/sub", [A, B]> {
  return makeCExpr<number, "num/sub", [A, B]>("num/sub", [a, b]);
}

// ─── Equality constructor ───────────────────────────────────────────

/** Create an equality comparison expression (trait-dispatched). */
export function eq<A, B>(a: A, b: B): CExpr<boolean, "eq", [A, B]> {
  return makeCExpr<boolean, "eq", [A, B]>("eq", [a, b]);
}

// ─── Literal constructors ───────────────────────────────────────────

/** Pass through a numeric literal value. */
export function numLit<V extends number>(v: V): V {
  return v;
}

/** Pass through a string literal value. */
export function strLit<V extends string>(v: V): V {
  return v;
}

/** Pass through a boolean literal value. */
export function boolLit<V extends boolean>(v: V): V {
  return v;
}
