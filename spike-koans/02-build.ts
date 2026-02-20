/**
 * Koan 02: Build — permissive constructors + registry
 *
 * Constructors accept ANYTHING. No validation at construction time.
 * The registry declares expected input/output types per node kind.
 * Validation happens at app() time (see 04-normalize).
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/02-build.ts
 */

export * from "./01-increment";

import type { CExpr, NodeEntry } from "./01-increment";
import { makeCExpr } from "./01-increment";

// ─── Registry types ─────────────────────────────────────────────────
export interface KindSpec<I extends readonly unknown[], O> {
  readonly inputs: I;
  readonly output: O;
}

export interface TraitKindSpec<O, Mapping extends Record<string, string>> {
  readonly trait: true;
  readonly output: O;
  readonly mapping: Mapping;
}

export type RegistryEntry = KindSpec<any, any> | TraitKindSpec<any, any>;

// ─── LiftKind: which node kind to create when lifting a raw value ───
export type LiftKind<T> =
  T extends number ? "num/literal" :
  T extends string ? "str/literal" :
  T extends boolean ? "bool/literal" :
  never;

// ─── TypeKey: map TS type to string key for trait resolution ────────
export type TypeKey<T> =
  T extends number ? "number" :
  T extends string ? "string" :
  T extends boolean ? "boolean" :
  never;

// ─── Standard registry ──────────────────────────────────────────────
export type StdRegistry = {
  "num/literal": KindSpec<[], number>;
  "num/add": KindSpec<[number, number], number>;
  "num/mul": KindSpec<[number, number], number>;
  "num/sub": KindSpec<[number, number], number>;
  "str/literal": KindSpec<[], string>;
  "bool/literal": KindSpec<[], boolean>;
  "num/eq": KindSpec<[number, number], boolean>;
  "str/eq": KindSpec<[string, string], boolean>;
  "bool/eq": KindSpec<[boolean, boolean], boolean>;
  "eq": TraitKindSpec<boolean, {
    number: "num/eq";
    string: "str/eq";
    boolean: "bool/eq";
  }>;
};

// ─── Permissive constructors ────────────────────────────────────────
// Accept anything. Output type is declared (optimistic).
// Validation deferred to app().

export function add<A, B>(a: A, b: B): CExpr<number, "num/add", [A, B]> {
  return makeCExpr<number, "num/add", [A, B]>("num/add", [a, b]);
}

export function mul<A, B>(a: A, b: B): CExpr<number, "num/mul", [A, B]> {
  return makeCExpr<number, "num/mul", [A, B]>("num/mul", [a, b]);
}

export function sub<A, B>(a: A, b: B): CExpr<number, "num/sub", [A, B]> {
  return makeCExpr<number, "num/sub", [A, B]>("num/sub", [a, b]);
}

export function eq<A, B>(a: A, b: B): CExpr<boolean, "eq", [A, B]> {
  return makeCExpr<boolean, "eq", [A, B]>("eq", [a, b]);
}

// ─── Backward-compat passthroughs ───────────────────────────────────
// numLit(3) === 3. Exists so old-style code still compiles.
export function numLit<V extends number>(v: V): V { return v; }
export function strLit<V extends string>(v: V): V { return v; }
export function boolLit<V extends boolean>(v: V): V { return v; }

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

import type { COutOf, CKindOf, CArgsOf } from "./01-increment";

// --- add captures exact arg types ---
const sum = add(3, 4);
type SumOut = COutOf<typeof sum>;
const _sumOut: SumOut = 42;
// @ts-expect-error — output is number
const _sumOutBad: SumOut = "nope";
type SumKind = CKindOf<typeof sum>;
const _sumKind: SumKind = "num/add";
type SumArgs = CArgsOf<typeof sum>;
const _sumArgs: SumArgs = [3, 4];

// --- Nested: mul(add(3,4), 5) ---
const product = mul(add(3, 4), 5);
type ProdKind = CKindOf<typeof product>;
const _prodKind: ProdKind = "num/mul";
type ProdArgs = CArgsOf<typeof product>;
// Arg 0 is a CExpr, arg 1 is 5
type ProdArg0 = ProdArgs[0];
type ProdArg0Kind = CKindOf<ProdArg0>;
const _prodArg0Kind: ProdArg0Kind = "num/add";

// --- Permissive: add(false, "foo") compiles ---
const bad = add(false, "foo");
type BadArgs = CArgsOf<typeof bad>;
const _badArgs: BadArgs = [false, "foo"];
// Still declares number output (optimistic)
type BadOut = COutOf<typeof bad>;
const _badOut: BadOut = 42;

// --- eq captures args ---
const eqExpr = eq(add(3, 4), add(5, 6));
type EqOut = COutOf<typeof eqExpr>;
const _eqOut: EqOut = true;
// @ts-expect-error — eq output is boolean
const _eqOutBad: EqOut = 42;

// --- numLit is now just a passthrough ---
const three = numLit(3);
const _threeVal: 3 = three;
// add(numLit(3), numLit(4)) still works — add accepts anything
const oldStyle = add(numLit(3), numLit(4));
type OldKind = CKindOf<typeof oldStyle>;
const _oldKind: OldKind = "num/add";
