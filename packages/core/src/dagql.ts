/**
 * DagQL — functional chaining via pipe.
 *
 * pipe() chains DAG operations with full type flow, using overloaded
 * signatures for 1-4 operations. Each operation is a plain function.
 */

import type { NExpr } from "./expr";

/** Chain 1 operation. */
export function pipe<A extends NExpr<any, any, any, any>, B>(expr: A, f1: (a: A) => B): B;
/** Chain 2 operations. */
export function pipe<A extends NExpr<any, any, any, any>, B, C>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
): C;
/** Chain 3 operations. */
export function pipe<A extends NExpr<any, any, any, any>, B, C, D>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
): D;
/** Chain 4 operations. */
export function pipe<A extends NExpr<any, any, any, any>, B, C, D, E>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): E;
/** Chain N operations on an NExpr, threading the result through each function. */
export function pipe(expr: any, ...fns: Array<(x: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), expr);
}
