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

/** Create a division expression. */
export function div<A, B>(a: A, b: B): CExpr<number, "num/div", [A, B]> {
  return makeCExpr<number, "num/div", [A, B]>("num/div", [a, b]);
}

/** Create a modulo expression. */
export function mod<A, B>(a: A, b: B): CExpr<number, "num/mod", [A, B]> {
  return makeCExpr<number, "num/mod", [A, B]>("num/mod", [a, b]);
}

// ─── Unary arithmetic constructors ──────────────────────────────────

/** Create a negation expression. */
export function neg<A>(a: A): CExpr<number, "num/neg", [A]> {
  return makeCExpr<number, "num/neg", [A]>("num/neg", [a]);
}

/** Create an absolute value expression. */
export function abs<A>(a: A): CExpr<number, "num/abs", [A]> {
  return makeCExpr<number, "num/abs", [A]>("num/abs", [a]);
}

/** Create a floor expression. */
export function floor<A>(a: A): CExpr<number, "num/floor", [A]> {
  return makeCExpr<number, "num/floor", [A]>("num/floor", [a]);
}

/** Create a ceil expression. */
export function ceil<A>(a: A): CExpr<number, "num/ceil", [A]> {
  return makeCExpr<number, "num/ceil", [A]>("num/ceil", [a]);
}

/** Create a round expression. */
export function round<A>(a: A): CExpr<number, "num/round", [A]> {
  return makeCExpr<number, "num/round", [A]>("num/round", [a]);
}

// ─── Binary min/max constructors ────────────────────────────────────

/** Create a minimum expression. */
export function min<A, B>(a: A, b: B): CExpr<number, "num/min", [A, B]> {
  return makeCExpr<number, "num/min", [A, B]>("num/min", [a, b]);
}

/** Create a maximum expression. */
export function max<A, B>(a: A, b: B): CExpr<number, "num/max", [A, B]> {
  return makeCExpr<number, "num/max", [A, B]>("num/max", [a, b]);
}

// ─── String constructors ─────────────────────────────────────────────

/** Create a string concatenation expression (variadic). */
export function concat<A extends readonly unknown[]>(...args: A): CExpr<string, "str/concat", A> {
  return makeCExpr<string, "str/concat", A>("str/concat", args as [...A]);
}

/** Create an uppercase expression. */
export function upper<A>(a: A): CExpr<string, "str/upper", [A]> {
  return makeCExpr<string, "str/upper", [A]>("str/upper", [a]);
}

/** Create a lowercase expression. */
export function lower<A>(a: A): CExpr<string, "str/lower", [A]> {
  return makeCExpr<string, "str/lower", [A]>("str/lower", [a]);
}

/** Create a trim expression. */
export function trim<A>(a: A): CExpr<string, "str/trim", [A]> {
  return makeCExpr<string, "str/trim", [A]>("str/trim", [a]);
}

/** Create a string slice expression. */
export function slice<A, B, C>(
  s: A,
  start: B,
  end?: C,
): CExpr<string, "str/slice", [A, B, ...unknown[]]> {
  const args = end !== undefined ? [s, start, end] : [s, start];
  return makeCExpr("str/slice", args as any) as any;
}

/** Create a string includes expression. */
export function includes<A, B>(s: A, search: B): CExpr<boolean, "str/includes", [A, B]> {
  return makeCExpr<boolean, "str/includes", [A, B]>("str/includes", [s, search]);
}

/** Create a string startsWith expression. */
export function startsWith<A, B>(s: A, prefix: B): CExpr<boolean, "str/startsWith", [A, B]> {
  return makeCExpr<boolean, "str/startsWith", [A, B]>("str/startsWith", [s, prefix]);
}

/** Create a string endsWith expression. */
export function endsWith<A, B>(s: A, suffix: B): CExpr<boolean, "str/endsWith", [A, B]> {
  return makeCExpr<boolean, "str/endsWith", [A, B]>("str/endsWith", [s, suffix]);
}

/** Create a string split expression. */
export function split<A, B>(s: A, sep: B): CExpr<string[], "str/split", [A, B]> {
  return makeCExpr<string[], "str/split", [A, B]>("str/split", [s, sep]);
}

/** Create a string join expression. */
export function join<A, B>(arr: A, sep: B): CExpr<string, "str/join", [A, B]> {
  return makeCExpr<string, "str/join", [A, B]>("str/join", [arr, sep]);
}

/** Create a string replace expression. */
export function replace<A, B, C>(
  s: A,
  search: B,
  replacement: C,
): CExpr<string, "str/replace", [A, B, C]> {
  return makeCExpr<string, "str/replace", [A, B, C]>("str/replace", [s, search, replacement]);
}

/** Create a string length expression. */
export function len<A>(s: A): CExpr<number, "str/len", [A]> {
  return makeCExpr<number, "str/len", [A]>("str/len", [s]);
}

/** Create a string show expression (identity for strings). */
export function strShow<A>(s: A): CExpr<string, "str/show", [A]> {
  return makeCExpr<string, "str/show", [A]>("str/show", [s]);
}

/** Create a string append expression (semigroup). */
export function strAppend<A, B>(a: A, b: B): CExpr<string, "str/append", [A, B]> {
  return makeCExpr<string, "str/append", [A, B]>("str/append", [a, b]);
}

/** Tagged template literal for string interpolation — desugars to str/concat. */
export function str(
  strings: TemplateStringsArray,
  ...exprs: unknown[]
): CExpr<string, "str/concat", unknown[]> {
  const parts: unknown[] = [];
  for (let i = 0; i < exprs.length; i++) {
    if (strings[i]) parts.push(strings[i]);
    parts.push(makeCExpr("show", [exprs[i]]));
  }
  if (strings[exprs.length]) parts.push(strings[exprs.length]);
  return makeCExpr("str/concat", parts as any) as any;
}

// ─── Boolean constructors ──────────────────────────────────────────
// NOTE: These are exported for use by std-plugins-bool.ts but must NOT
// be re-exported from index.ts (conflicts with predicates.ts).

/** Create a boolean AND expression. */
export function boolAnd<A, B>(a: A, b: B): CExpr<boolean, "bool/and", [A, B]> {
  return makeCExpr<boolean, "bool/and", [A, B]>("bool/and", [a, b]);
}

/** Create a boolean OR expression. */
export function boolOr<A, B>(a: A, b: B): CExpr<boolean, "bool/or", [A, B]> {
  return makeCExpr<boolean, "bool/or", [A, B]>("bool/or", [a, b]);
}

/** Create a boolean NOT expression. */
export function boolNot<A>(a: A): CExpr<boolean, "bool/not", [A]> {
  return makeCExpr<boolean, "bool/not", [A]>("bool/not", [a]);
}

// ─── Equality constructor ───────────────────────────────────────────

/** Create an equality comparison expression (trait-dispatched). */
export function eq<A, B>(a: A, b: B): CExpr<boolean, "eq", [A, B]> {
  return makeCExpr<boolean, "eq", [A, B]>("eq", [a, b]);
}

// ─── Schema descriptors ─────────────────────────────────────────────

/** Describe an array type in an input schema. */
export function array(type: string): string {
  return `${type}[]`;
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
