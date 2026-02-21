/**
 * Elaborate-structural-types — structural elaboration type chain.
 *
 * Handles type-level elaboration for records, tuples, and primitive lifts
 * within structural contexts. Separated from elaborate-types to stay under
 * the 300-line file limit.
 */

// Circular type-only import (safe — types are erased at runtime)
import type {
  DeepResolve,
  ElaborateExpr,
  NeverGuard,
  SNodeEntry,
  UnionToTuple,
} from "./elaborate-types";
import type { CExpr } from "./expr";
import type { Increment } from "./increment";
import type { LiftKind } from "./registry";

// ─── ElaborateStructural: walk structures ───────────────────────────

export type ElaborateStructural<Reg, Value, Expected, Adj, Ctr extends string> =
  // CExpr leaf
  Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2,
          infer C2 extends string,
          infer Id extends string,
          infer O,
        ]
          ? [A2, C2, Id, O]
          : never
      >
    : // Empty tuple
      Value extends readonly []
      ? Expected extends readonly []
        ? [Adj, Ctr, [], []]
        : never
      : // Non-empty tuple — positional
        Value extends readonly [infer H, ...infer Rest]
        ? Expected extends readonly [infer EH, ...infer ERest]
          ? NeverGuard<
              ElaborateLeaf<Reg, H, EH, Adj, Ctr>,
              ElaborateLeaf<Reg, H, EH, Adj, Ctr> extends [
                infer A2,
                infer C2 extends string,
                infer CR,
              ]
                ? NeverGuard<
                    ElaborateStructural<Reg, Rest, ERest, A2, C2>,
                    ElaborateStructural<Reg, Rest, ERest, A2, C2> extends [
                      infer A3,
                      infer C3 extends string,
                      infer CRest extends unknown[],
                      any,
                    ]
                      ? [A3, C3, [CR, ...CRest], Expected]
                      : never
                  >
                : never
            >
          : never
        : // Record — named map {key: ChildRef}
          Value extends object
          ? Expected extends object
            ? NeverGuard<
                ElaborateRecordFields<
                  Reg,
                  Value,
                  Expected,
                  UnionToTuple<keyof Expected & string> extends infer K extends string[] ? K : [],
                  Adj,
                  Ctr
                >,
                ElaborateRecordFields<
                  Reg,
                  Value,
                  Expected,
                  UnionToTuple<keyof Expected & string> extends infer K extends string[] ? K : [],
                  Adj,
                  Ctr
                > extends [infer A2, infer C2 extends string, infer Map]
                  ? [A2, C2, Map, Expected]
                  : never
              >
            : never
          : // Primitive lift
            Value extends number
            ? [
                Adj & Record<Ctr, SNodeEntry<"num/literal", [], number>>,
                Increment<Ctr>,
                Ctr,
                number,
              ]
            : Value extends string
              ? [
                  Adj & Record<Ctr, SNodeEntry<"str/literal", [], string>>,
                  Increment<Ctr>,
                  Ctr,
                  string,
                ]
              : Value extends boolean
                ? [
                    Adj & Record<Ctr, SNodeEntry<"bool/literal", [], boolean>>,
                    Increment<Ctr>,
                    Ctr,
                    boolean,
                  ]
                : never;

// ─── ElaborateRecordFields: iterate record keys ─────────────────────

export type ElaborateRecordFields<
  Reg,
  Value,
  Expected,
  Keys extends readonly string[],
  Adj,
  Ctr extends string,
> = Keys extends readonly []
  ? [Adj, Ctr, {}]
  : Keys extends readonly [
        infer K extends string & keyof Expected & keyof Value,
        ...infer Rest extends string[],
      ]
    ? NeverGuard<
        ElaborateLeaf<Reg, Value[K], Expected[K], Adj, Ctr>,
        ElaborateLeaf<Reg, Value[K], Expected[K], Adj, Ctr> extends [
          infer A2,
          infer C2 extends string,
          infer CR,
        ]
          ? NeverGuard<
              ElaborateRecordFields<Reg, Value, Expected, Rest, A2, C2>,
              ElaborateRecordFields<Reg, Value, Expected, Rest, A2, C2> extends [
                infer A3,
                infer C3 extends string,
                infer RestMap,
              ]
                ? [A3, C3, Record<K, CR> & RestMap]
                : never
            >
          : never
      >
    : never;

// ─── ElaborateLeaf: elaborate a structural leaf ─────────────────────

export type ElaborateLeaf<Reg, Value, Expected, Adj, Ctr extends string> =
  // Accessor CExpr — trust O
  Value extends { __kind: "core/access"; __out: infer O }
    ? O extends Expected
      ? [Adj & Record<Ctr, SNodeEntry<"core/access", [], O>>, Increment<Ctr>, Ctr]
      : never
    : // Regular CExpr
      Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
      ? NeverGuard<
          ElaborateExpr<Reg, K, A, Adj, Ctr>,
          ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
            infer A2,
            infer C2 extends string,
            infer Id extends string,
            infer O,
          ]
            ? O extends Expected
              ? [A2, C2, Id]
              : never
            : never
        >
      : // No lift kind → structural
        [LiftKind<Expected>] extends [never]
        ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
            infer A2,
            infer C2 extends string,
            infer CR,
            any,
          ]
          ? [A2, C2, CR]
          : never
        : // Has lift kind → try lift, fallback to structural
          Value extends Expected
          ? [Adj & Record<Ctr, SNodeEntry<LiftKind<Expected>, [], Expected>>, Increment<Ctr>, Ctr]
          : DeepResolve<Value> extends Expected
            ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
                infer A2,
                infer C2 extends string,
                infer CR,
                any,
              ]
              ? [A2, C2, CR]
              : never
            : never;
