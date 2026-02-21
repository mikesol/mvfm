/** Elaborate — type-level elaboration and runtime normalization. */

import type { CExpr, NExpr, NodeEntry, RuntimeEntry } from "./expr";
import { isCExpr, makeNExpr } from "./expr";
import type { Increment } from "./increment";
import { incrementId } from "./increment";
import type { Plugin, RegistryOf } from "./plugin";
import { buildKindInputs, buildLiftMap, buildTraitMap } from "./plugin";
import { stdPlugins } from "./std-plugins";
import type { KindSpec, LiftKind, StdRegistry, TraitKindSpec, TypeKey } from "./registry";

/** Guards against `never` propagation in conditional types. */
export type NeverGuard<T, Then> = [T] extends [never] ? never : Then;

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
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
    : Arg extends Expected
      ? LiftKind<Expected> extends infer LK extends string
        ? [Adj & Record<Ctr, NodeEntry<LK, [], Expected>>, Increment<Ctr>, Ctr, Expected]
        : never
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
            any,
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

// ─── Precomputed runtime maps from stdPlugins ───────────────────────

/** Lift map from stdPlugins: maps TS type names to literal node kinds. */
export const LIFT_MAP: Record<string, string> = buildLiftMap(stdPlugins);

/** Trait map from stdPlugins: maps trait names to type-to-kind mappings. */
export const TRAIT_MAP: Record<string, Record<string, string>> = buildTraitMap(stdPlugins);

/** Kind-inputs map from stdPlugins: maps kind names to input type arrays. */
export const KIND_INPUTS: Record<string, string[]> = buildKindInputs(stdPlugins);

// ─── Runtime elaboration ────────────────────────────────────────────

function buildKindOutputs(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = typeof (spec as KindSpec<any, any>).output;
    }
  }
  return m;
}

function elaborate(
  expr: CExpr<unknown>,
  liftMap: Record<string, string>,
  traitMap: Record<string, Record<string, string>>,
  kindInputs: Record<string, string[]>,
  kindOutputs: Record<string, string>,
): { rootId: string; entries: Record<string, RuntimeEntry>; counter: string } {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  function visit(arg: unknown, expected?: string): [string, string] {
    if (isCExpr(arg)) {
      const cexpr = arg as CExpr<unknown>;
      let kind = cexpr.__kind;
      const args = cexpr.__args;

      if (kind in traitMap) {
        const childResults = args.map((a) => visit(a));
        const childType = childResults[0][1];
        const resolved = traitMap[kind]?.[childType];
        if (!resolved) {
          throw new Error(`No trait "${kind}" instance for type "${childType}"`);
        }
        kind = resolved;
        const childIds = childResults.map(([id]) => id);
        const nodeId = counter;
        counter = incrementId(counter);
        if (kindInputs[kind] && childResults[1][1] !== childResults[0][1]) {
          throw new Error(
            `Trait "${cexpr.__kind}": args have different types (${childResults[0][1]} vs ${childResults[1][1]})`,
          );
        }
        entries[nodeId] = { kind, children: childIds, out: undefined };
        return [nodeId, kindOutputs[kind] ?? "unknown"];
      }

      const expectedInputs = kindInputs[kind];
      const childIds: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const exp = expectedInputs ? expectedInputs[i] : undefined;
        const [childId, childType] = visit(args[i], exp);
        if (exp && childType !== exp) {
          throw new Error(`${kind}: expected ${exp} for arg ${i}, got ${childType}`);
        }
        childIds.push(childId);
      }
      const nodeId = counter;
      counter = incrementId(counter);
      entries[nodeId] = { kind, children: childIds, out: undefined };
      return [nodeId, kindOutputs[kind] ?? "unknown"];
    }

    const typeTag = typeof arg;
    const liftKind = liftMap[typeTag];
    if (!liftKind) throw new Error(`Cannot lift value of type "${typeTag}"`);
    if (expected && typeTag !== expected) {
      throw new Error(`Expected ${expected}, got ${typeTag} (value: ${String(arg)})`);
    }
    const nodeId = counter;
    counter = incrementId(counter);
    entries[nodeId] = { kind: liftKind, children: [], out: arg };
    return [nodeId, typeTag];
  }

  const [rootId] = visit(expr);
  return { rootId, entries, counter };
}

// ─── Public API ─────────────────────────────────────────────────────

/** Create a typed app function from a custom set of plugins. */
export function createApp<const P extends readonly Plugin[]>(...plugins: P) {
  const lm = buildLiftMap(plugins);
  const tm = buildTraitMap(plugins);
  const ki = buildKindInputs(plugins);
  const ko = buildKindOutputs(plugins);
  return <Expr extends CExpr<any, string, readonly unknown[]>>(
    expr: Expr,
  ): AppResult<RegistryOf<P>, Expr> => {
    const { rootId, entries, counter } = elaborate(expr, lm, tm, ki, ko);
    return makeNExpr(rootId, entries, counter) as any;
  };
}

/** Elaborate a CExpr into a normalized NExpr using the standard registry. */
export function app<Expr extends CExpr<any, string, readonly unknown[]>, Reg = StdRegistry>(
  expr: Expr,
): AppResult<Reg, Expr> {
  const ko = buildKindOutputs(stdPlugins);
  const { rootId, entries, counter } = elaborate(expr, LIFT_MAP, TRAIT_MAP, KIND_INPUTS, ko);
  return makeNExpr(rootId, entries, counter) as any;
}
