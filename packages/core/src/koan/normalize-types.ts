import type { CExpr, KindSpec, LiftKind, NExpr, NodeEntry, TraitKindSpec, TypeKey } from "./expr";
import type { Increment } from "./increment";

/** Never-safe conditional helper used by recursive elaboration types. */
export type NeverGuard<T, Then = never> = [T] extends [never] ? never : Then;

type ElaborateTupleArg<
  Reg,
  Arg extends readonly unknown[],
  Expected extends readonly unknown[],
  Adj,
  Ctr extends string,
> = NeverGuard<
  ElaborateChildren<Reg, Arg, Expected, Adj, Ctr>,
  ElaborateChildren<Reg, Arg, Expected, Adj, Ctr> extends [
    infer A2,
    infer C2 extends string,
    infer Ids extends string[],
  ]
    ? [A2 & Record<C2, NodeEntry<"core/tuple", [], Ids>>, Increment<C2>, C2, Expected]
    : never
>;

type ObjectKeys<T> = Extract<keyof T, string>;

type ElaborateObjectFields<
  Reg,
  Arg extends object,
  Expected extends object,
  Remaining extends string,
  Adj,
  Ctr extends string,
  OutMap extends Record<string, string> = {},
> = [Remaining] extends [never]
  ? [Adj, Ctr, OutMap]
  : Remaining extends infer K extends string
    ? K extends keyof Expected
      ? K extends keyof Arg
        ? NeverGuard<
            ElaborateArg<Reg, Arg[K], Expected[K], Adj, Ctr>,
            ElaborateArg<Reg, Arg[K], Expected[K], Adj, Ctr> extends [
              infer A2,
              infer C2 extends string,
              infer Id extends string,
              unknown,
            ]
              ? NeverGuard<
                  ElaborateObjectFields<
                    Reg,
                    Arg,
                    Expected,
                    Exclude<Remaining, K>,
                    A2,
                    C2,
                    OutMap & Record<K, Id>
                  >,
                  ElaborateObjectFields<
                    Reg,
                    Arg,
                    Expected,
                    Exclude<Remaining, K>,
                    A2,
                    C2,
                    OutMap & Record<K, Id>
                  > extends [
                    infer A3,
                    infer C3 extends string,
                    infer M extends Record<string, string>,
                  ]
                    ? [A3, C3, M]
                    : never
                >
              : never
          >
        : never
      : never
    : never;

type ElaborateObjectArg<
  Reg,
  Arg extends object,
  Expected extends object,
  Adj,
  Ctr extends string,
> = NeverGuard<
  ElaborateObjectFields<Reg, Arg, Expected, ObjectKeys<Expected>, Adj, Ctr>,
  ElaborateObjectFields<Reg, Arg, Expected, ObjectKeys<Expected>, Adj, Ctr> extends [
    infer A2,
    infer C2 extends string,
    infer M extends Record<string, string>,
  ]
    ? [A2 & Record<C2, NodeEntry<"core/record", [], M>>, Increment<C2>, C2, Expected]
    : never
>;

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  Arg extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
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
    : Expected extends readonly unknown[]
      ? Arg extends readonly unknown[]
        ? ElaborateTupleArg<Reg, Arg, Expected, Adj, Ctr>
        : never
      : Expected extends object
        ? Arg extends object
          ? ElaborateObjectArg<Reg, Arg, Expected, Adj, Ctr>
          : never
        : Arg extends Expected
          ? LiftKind<Expected> extends infer LK extends string
            ? [Adj & Record<Ctr, NodeEntry<LK, [], Expected>>, Increment<Ctr>, Ctr, Expected]
            : never
          : never;

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
            infer Id extends string,
            unknown,
          ]
            ? NeverGuard<
                ElaborateChildren<Reg, AT, ET, A2, C2>,
                ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                  infer A3,
                  infer C3 extends string,
                  infer Ids extends string[],
                ]
                  ? [A3, C3, [Id, ...Ids]]
                  : never
              >
            : never
        >
      : never
    : never;

type ElaborateArgInfer<Reg, Arg, Adj, Ctr extends string> =
  Arg extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
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
              unknown,
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

type ElaborateExpr<
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
          infer Ids extends string[],
        ]
          ? [A2 & Record<C2, NodeEntry<Kind, Ids, O>>, Increment<C2>, C2, O]
          : never
      >
    : Reg[Kind] extends TraitKindSpec<infer O, infer Mapping>
      ? ElaborateTraitExpr<Reg, O, Mapping, Args, Adj, Ctr>
      : never
  : never;

/** Type-level normalized result of elaborating a permissive CExpr. */
export type AppResult<Reg, Expr> =
  Expr extends CExpr<unknown, infer K extends string, infer A extends readonly unknown[]>
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
