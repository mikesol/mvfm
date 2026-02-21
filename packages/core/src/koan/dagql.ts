import type { NExpr } from "./expr";

/** Functional DAG transform composition with full type flow. */
export function pipe<A extends NExpr<any, any, any, any>, B>(expr: A, f1: (a: A) => B): B;
/** Functional DAG transform composition with full type flow. */
export function pipe<A extends NExpr<any, any, any, any>, B, C>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
): C;
/** Functional DAG transform composition with full type flow. */
export function pipe<A extends NExpr<any, any, any, any>, B, C, D>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
): D;
/** Functional DAG transform composition with full type flow. */
export function pipe<A extends NExpr<any, any, any, any>, B, C, D, E>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
): E;
/** Functional DAG transform composition with full type flow. */
export function pipe<A extends NExpr<any, any, any, any>, B, C, D, E, F>(
  expr: A,
  f1: (a: A) => B,
  f2: (b: B) => C,
  f3: (c: C) => D,
  f4: (d: D) => E,
  f5: (e: E) => F,
): F;
export function pipe(expr: unknown, ...fns: Array<(x: unknown) => unknown>): unknown {
  return fns.reduce((acc, fn) => fn(acc), expr);
}
