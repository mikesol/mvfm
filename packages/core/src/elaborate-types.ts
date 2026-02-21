/**
 * Elaborate-types — type-level elaboration for CExpr → NExpr.
 *
 * Contains core compile-time type computation:
 * - ElaborateArg/ElaborateExpr/ElaborateChildren: core elaboration chain
 * - ElaborateTraitExpr/ElaborateArgInfer: trait dispatch
 * - AppResult: top-level elaboration entry point
 *
 * Structural types (ElaborateStructural/ElaborateRecordFields/ElaborateLeaf)
 * live in elaborate-structural-types.ts to stay under the 300-line limit.
 */

// Circular type-only import (safe — types are erased at runtime)
import type { ElaborateStructural } from "./elaborate-structural-types";
import type { CExpr, NExpr, NodeEntry } from "./expr";
import type { Increment } from "./increment";
import type { KindSpec, LiftKind, TraitKindSpec, TypeKey } from "./registry";

// Re-export structural types so consumers can import from one place
export type {
  ElaborateLeaf,
  ElaborateRecordFields,
  ElaborateStructural,
} from "./elaborate-structural-types";

// ─── Guards ──────────────────────────────────────────────────────────

/** Guards against `never` propagation in conditional types. */
export type NeverGuard<T, Then> = [T] extends [never] ? never : Then;

// ─── SNodeEntry: flexible children (string | Record | array) ────────

/** Node entry with unconstrained children for structural elaboration. */
export type SNodeEntry<Kind extends string = string, Ch = unknown, O = unknown> = {
  readonly kind: Kind;
  readonly children: Ch;
  readonly out: O;
};

// ─── DeepResolve: recursively resolve CExprs to output types ────────

/** Recursively resolves CExprs inside structures to their output types. */
export type DeepResolve<T> =
  T extends CExpr<infer O, any, any>
    ? O
    : T extends readonly []
      ? []
      : T extends readonly [infer H, ...infer Rest]
        ? [DeepResolve<H>, ...DeepResolve<Rest>]
        : T extends object
          ? { [K in keyof T]: DeepResolve<T[K]> }
          : T;

// ─── UnionToTuple: convert union to tuple for record key iteration ──

type _UTI<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type _LastOf<U> = _UTI<U extends any ? () => U : never> extends () => infer R ? R : never;

/** Convert a union to a tuple (iteration order is implementation-defined). */
export type UnionToTuple<U, Last = _LastOf<U>> = [U] extends [never]
  ? []
  : [...UnionToTuple<Exclude<U, Last>>, Last];

// ─── ElaborateArg: per-argument elaboration ─────────────────────────

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  // Accessor CExpr — trust O (AccessorOverlay guarantees type safety)
  Arg extends { __kind: "core/access"; __out: infer O }
    ? O extends Expected
      ? [Adj & Record<Ctr, SNodeEntry<"core/access", [], O>>, Increment<Ctr>, Ctr, O]
      : never
    : // Regular CExpr
      Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
      ? NeverGuard<
          ElaborateExpr<Reg, K, A, Adj, Ctr>,
          ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
            infer A2,
            infer C2 extends string,
            infer Id extends string,
            infer O,
          ]
            ? O extends Expected
              ? [A2, C2, Id, O]
              : never
            : never
        >
      : // No lift kind → try structural
        [LiftKind<Expected>] extends [never]
        ? DeepResolve<Arg> extends Expected
          ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
          : never
        : // Has lift kind → try literal lift, fallback to structural
          Arg extends Expected
          ? [
              Adj & Record<Ctr, SNodeEntry<LiftKind<Expected>, [], Expected>>,
              Increment<Ctr>,
              Ctr,
              Expected,
            ]
          : DeepResolve<Arg> extends Expected
            ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
            : never;

// ─── ElaborateExpr: kind dispatch ───────────────────────────────────

export type ElaborateExpr<
  Reg,
  Kind extends string,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Kind extends keyof Reg
  ? Reg[Kind] extends KindSpec<infer Inputs extends readonly unknown[], infer O>
    ? NeverGuard<
        ElaborateChildren<Reg, Args, Inputs, Adj, Ctr>,
        ElaborateChildren<Reg, Args, Inputs, Adj, Ctr> extends [
          infer A2,
          infer C2 extends string,
          infer Ch,
        ]
          ? [A2 & Record<C2, SNodeEntry<Kind, Ch, O>>, Increment<C2>, C2, O]
          : never
      >
    : Reg[Kind] extends TraitKindSpec<infer O, infer Mapping>
      ? ElaborateTraitExpr<Reg, O, Mapping, Args, Adj, Ctr>
      : never
  : never;

// ─── ElaborateChildren: accumulate ChildRefs ────────────────────────

type ElaborateChildren<
  Reg,
  Args extends readonly unknown[],
  Expected extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Args extends readonly []
  ? Expected extends readonly []
    ? [Adj, Ctr, []]
    : never
  : Args extends readonly [infer AH, ...infer AT extends readonly unknown[]]
    ? Expected extends readonly [infer EH, ...infer ET extends readonly unknown[]]
      ? NeverGuard<
          ElaborateArg<Reg, AH, EH, Adj, Ctr>,
          ElaborateArg<Reg, AH, EH, Adj, Ctr> extends [
            infer A2,
            infer C2 extends string,
            infer CR,
            any,
          ]
            ? NeverGuard<
                ElaborateChildren<Reg, AT, ET, A2, C2>,
                ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                  infer A3,
                  infer C3 extends string,
                  infer CRest extends unknown[],
                ]
                  ? [A3, C3, [CR, ...CRest]]
                  : never
              >
            : never
        >
      : never
    : never;

// ─── ElaborateTraitExpr: trait dispatch ──────────────────────────────

type ElaborateTraitExpr<
  Reg,
  O,
  Mapping,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> = Args extends readonly [infer A, infer B]
  ? NeverGuard<
      ElaborateArgInfer<Reg, A, Adj, Ctr>,
      ElaborateArgInfer<Reg, A, Adj, Ctr> extends [
        infer A2,
        infer C2 extends string,
        infer Id1 extends string,
        infer T1,
      ]
        ? NeverGuard<
            ElaborateArg<Reg, B, T1, A2, C2>,
            ElaborateArg<Reg, B, T1, A2, C2> extends [
              infer A3,
              infer C3 extends string,
              infer Id2 extends string,
              any,
            ]
              ? TypeKey<T1> extends infer TK extends string
                ? TK extends keyof Mapping
                  ? Mapping[TK] extends infer RK extends string
                    ? [A3 & Record<C3, NodeEntry<RK, [Id1, Id2], O>>, Increment<C3>, C3, O]
                    : never
                  : never
                : never
              : never
          >
        : never
    >
  : never;

// ─── ElaborateArgInfer: infer output type ───────────────────────────

type ElaborateArgInfer<Reg, Arg, Adj, Ctr extends string> =
  Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? ElaborateExpr<Reg, K, A, Adj, Ctr>
    : Arg extends number
      ? [Adj & Record<Ctr, NodeEntry<"num/literal", [], number>>, Increment<Ctr>, Ctr, number]
      : Arg extends string
        ? [Adj & Record<Ctr, NodeEntry<"str/literal", [], string>>, Increment<Ctr>, Ctr, string]
        : Arg extends boolean
          ? [
              Adj & Record<Ctr, NodeEntry<"bool/literal", [], boolean>>,
              Increment<Ctr>,
              Ctr,
              boolean,
            ]
          : never;

// ─── AppResult: top-level entry point ───────────────────────────────

/** Elaborates a CExpr into a fully-typed NExpr against a registry. */
export type AppResult<Reg, Expr> =
  Expr extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, {}, "a">,
        ElaborateExpr<Reg, K, A, {}, "a"> extends [
          infer Adj,
          infer C extends string,
          infer R extends string,
          infer O,
        ]
          ? NExpr<O, R, Adj, C>
          : never
      >
    : never;
