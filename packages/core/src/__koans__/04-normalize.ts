/**
 * Koan 04: Normalize — elaborating app()
 *
 * app() takes a permissive CExpr and a registry, then:
 * 1. Walks the CExpr tree
 * 2. Lifts raw values into literal nodes
 * 3. Validates types against the registry
 * 4. Resolves traits (eq → num/eq, str/eq, etc.)
 * 5. Produces a clean NExpr with sequential IDs
 *
 * Type-level: Elaborate<Reg, Expr> mirrors the runtime walk.
 * Errors become `never`, surfacing as type errors at the call site.
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/04-normalize.ts
 *   npx tsx spike-koans/04-normalize.ts
 */

export * from "./03a-composition";

import type {
  NodeEntry,
  CExpr,
  NExpr,
  IdOf,
  AdjOf,
  CtrOf,
  OutOf,
  RuntimeEntry,
  Increment,
  KindSpec,
  TraitKindSpec,
  StdRegistry,
  LiftKind,
  TypeKey,
  Plugin,
  RegistryOf,
} from "./03a-composition";
import {
  makeNExpr, incrementId, isCExpr, add, mul, sub, eq,
  buildLiftMap, buildTraitMap, buildKindInputs, stdPlugins,
  lt, ordPlugin,
} from "./03a-composition";

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL ELABORATOR
// ═══════════════════════════════════════════════════════════════════════

// All elaborate results: [Adj, NextCtr, ThisNodeId, OutputType]

// ─── NeverGuard: prevents `never extends [infer ...]` from matching ──
// `never` is the bottom type and extends everything, so
// `never extends [infer A, infer B]` matches and infers unknown.
// Wrapping in [X] extends [never] catches this before matching.
export type NeverGuard<T, Then> = [T] extends [never] ? never : Then;

// ─── ElaborateArg: elaborate one argument against an expected type ───
// If arg is a CExpr: recursively elaborate, check output matches expected.
// If arg is a raw value: lift to a literal node if it matches expected.
type ElaborateArg<
  Reg,
  Arg,
  Expected,
  Adj,
  Ctr extends string,
> =
  // Case 1: CExpr — recurse
  Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ]
          ? O extends Expected
            ? [A2, C2, Id, O]
            : never // output type mismatch
          : never
      >
    // Case 2: raw value — lift
    : Arg extends Expected
      ? LiftKind<Expected> extends infer LK extends string
        ? [
            Adj & Record<Ctr, NodeEntry<LK, [], Expected>>,
            Increment<Ctr>,
            Ctr,
            Expected,
          ]
        : never // no lifter for this type
      : never; // can't lift — type mismatch

// ─── ElaborateExpr: elaborate a CExpr node ──────────────────────────
type ElaborateExpr<
  Reg,
  Kind extends string,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> =
  Kind extends keyof Reg
    ? Reg[Kind] extends KindSpec<infer Inputs extends readonly unknown[], infer O>
      ? NeverGuard<
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr>,
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr> extends [
            infer A2, infer C2 extends string, infer Ids extends string[],
          ]
            ? [
                A2 & Record<C2, NodeEntry<Kind, Ids, O>>,
                Increment<C2>,
                C2,
                O,
              ]
            : never
        >
      : Reg[Kind] extends TraitKindSpec<infer O, infer Mapping>
        ? ElaborateTraitExpr<Reg, O, Mapping, Args, Adj, Ctr>
        : never
    : never;

// ─── ElaborateChildren: elaborate each arg against expected types ────
type ElaborateChildren<
  Reg,
  Args extends readonly unknown[],
  Expected extends readonly unknown[],
  Adj,
  Ctr extends string,
> =
  Args extends readonly []
    ? Expected extends readonly []
      ? [Adj, Ctr, []]
      : never // arity mismatch
    : Args extends readonly [infer AH, ...infer AT extends readonly unknown[]]
      ? Expected extends readonly [infer EH, ...infer ET extends readonly unknown[]]
        ? NeverGuard<
            ElaborateArg<Reg, AH, EH, Adj, Ctr>,
            ElaborateArg<Reg, AH, EH, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer Id extends string, any,
            ]
              ? NeverGuard<
                  ElaborateChildren<Reg, AT, ET, A2, C2>,
                  ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                    infer A3, infer C3 extends string, infer Ids extends string[],
                  ]
                    ? [A3, C3, [Id, ...Ids]]
                    : never
                >
              : never
          >
        : never
      : never;

// ─── ElaborateTraitExpr: elaborate a trait (e.g. "eq") ──────────────
// 1. Infer the type of the first arg (unconstrained)
// 2. Elaborate second arg with that same type as constraint
// 3. Resolve the trait via mapping
type ElaborateTraitExpr<
  Reg,
  O,
  Mapping,
  Args extends readonly unknown[],
  Adj,
  Ctr extends string,
> =
  Args extends readonly [infer A, infer B]
    ? NeverGuard<
        ElaborateArgInfer<Reg, A, Adj, Ctr>,
        ElaborateArgInfer<Reg, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id1 extends string, infer T1,
        ]
          ? NeverGuard<
              ElaborateArg<Reg, B, T1, A2, C2>,
              ElaborateArg<Reg, B, T1, A2, C2> extends [
                infer A3, infer C3 extends string, infer Id2 extends string, any,
              ]
                ? TypeKey<T1> extends infer TK extends string
                  ? TK extends keyof Mapping
                    ? Mapping[TK] extends infer RK extends string
                      ? [
                          A3 & Record<C3, NodeEntry<RK, [Id1, Id2], O>>,
                          Increment<C3>,
                          C3,
                          O,
                        ]
                      : never
                    : never
                  : never
                : never
            >
          : never
      >
    : never;

// ─── ElaborateArgInfer: elaborate an arg, inferring its type ────────
// Used for trait first-arg where we don't know the expected type yet.
type ElaborateArgInfer<
  Reg,
  Arg,
  Adj,
  Ctr extends string,
> =
  Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? ElaborateExpr<Reg, K, A, Adj, Ctr>
    : Arg extends number
      ? [
          Adj & Record<Ctr, NodeEntry<"num/literal", [], number>>,
          Increment<Ctr>,
          Ctr,
          number,
        ]
      : Arg extends string
        ? [
            Adj & Record<Ctr, NodeEntry<"str/literal", [], string>>,
            Increment<Ctr>,
            Ctr,
            string,
          ]
        : Arg extends boolean
          ? [
              Adj & Record<Ctr, NodeEntry<"bool/literal", [], boolean>>,
              Increment<Ctr>,
              Ctr,
              boolean,
            ]
          : never;

// ─── AppResult: top-level elaboration ───────────────────────────────
export type AppResult<Reg, Expr> =
  Expr extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, {}, "a">,
        ElaborateExpr<Reg, K, A, {}, "a"> extends [
          infer Adj, infer C extends string, infer R extends string, infer O,
        ]
          ? NExpr<O, R, Adj, C>
          : never
      >
    : never;

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME: elaborate + createApp + app
// ═══════════════════════════════════════════════════════════════════════

// Module-level maps for backward compatibility (04a uses LIFT_MAP)
export const LIFT_MAP: Record<string, string> = buildLiftMap(stdPlugins);
export const TRAIT_MAP: Record<string, Record<string, string>> = buildTraitMap(stdPlugins);
export const KIND_INPUTS: Record<string, string[]> = buildKindInputs(stdPlugins);

// Build kind→outputTypeTag map from plugin specs
function buildKindOutputs(plugins: readonly Plugin[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of plugins) {
    for (const [kind, spec] of Object.entries(p.kinds)) {
      m[kind] = typeof (spec as KindSpec<any, any>).output;
    }
  }
  return m;
}

// Core elaboration logic — parameterized over maps
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

      // Trait resolution
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

      // Regular node
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

    // Raw value: lift
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

/** Create a typed app() from a plugin set. Forces the elaborator to be generic. */
export function createApp<const P extends readonly Plugin[]>(...plugins: P) {
  const lm = buildLiftMap(plugins);
  const tm = buildTraitMap(plugins);
  const ki = buildKindInputs(plugins);
  const ko = buildKindOutputs(plugins);
  return function <Expr extends CExpr<any, string, readonly unknown[]>>(
    expr: Expr,
  ): AppResult<RegistryOf<P>, Expr> {
    const { rootId, entries, counter } = elaborate(expr, lm, tm, ki, ko);
    return makeNExpr(rootId, entries, counter) as any;
  };
}

/** Default app: uses stdPlugins. */
export function app<
  Expr extends CExpr<any, string, readonly unknown[]>,
  Reg = StdRegistry,
>(expr: Expr): AppResult<Reg, Expr> {
  const ko = buildKindOutputs(stdPlugins);
  const { rootId, entries, counter } = elaborate(expr, LIFT_MAP, TRAIT_MAP, KIND_INPUTS, ko);
  return makeNExpr(rootId, entries, counter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// --- add(3, 4) → same as old app(add(numLit(3), numLit(4))) ---
const prog1 = app(add(3, 4));
type P1Id = IdOf<typeof prog1>;
const _p1Id: P1Id = "c";
type P1Adj = AdjOf<typeof prog1>;
const _p1a: P1Adj["a"]["kind"] = "num/literal";
const _p1b: P1Adj["b"]["kind"] = "num/literal";
const _p1c: P1Adj["c"]["kind"] = "num/add";
const _p1cCh: P1Adj["c"]["children"] = ["a", "b"];

// --- mul(add(3,4), 5) → 5 nodes, root "e" ---
const prog2 = app(mul(add(3, 4), 5));
type P2Id = IdOf<typeof prog2>;
const _p2Id: P2Id = "e";
type P2Adj = AdjOf<typeof prog2>;
const _p2a: P2Adj["a"]["kind"] = "num/literal";
const _p2b: P2Adj["b"]["kind"] = "num/literal";
const _p2c: P2Adj["c"]["kind"] = "num/add";
const _p2d: P2Adj["d"]["kind"] = "num/literal";
const _p2e: P2Adj["e"]["kind"] = "num/mul";
const _p2eCh: P2Adj["e"]["children"] = ["c", "d"];

// Counter
type P2Ctr = CtrOf<typeof prog2>;
const _p2Ctr: P2Ctr = "f";

// Output type
type P2Out = OutOf<typeof prog2>;
const _p2Out: P2Out = 42;
// @ts-expect-error — number, not string
const _p2OutBad: P2Out = "nope";

// --- eq(3, 4) → resolves to num/eq ---
const prog3 = app(eq(3, 4));
type P3Adj = AdjOf<typeof prog3>;
const _p3a: P3Adj["a"]["kind"] = "num/literal";
const _p3b: P3Adj["b"]["kind"] = "num/literal";
const _p3c: P3Adj["c"]["kind"] = "num/eq";
type P3Out = OutOf<typeof prog3>;
const _p3Out: P3Out = true;

// --- eq("hello", "world") → resolves to str/eq ---
const prog4 = app(eq("hello", "world"));
type P4Adj = AdjOf<typeof prog4>;
const _p4a: P4Adj["a"]["kind"] = "str/literal";
const _p4c: P4Adj["c"]["kind"] = "str/eq";

// --- Nested eq: eq(eq(3,3), eq(5,5)) → bool/eq ---
const prog5 = app(eq(eq(3, 3), eq(5, 5)));
type P5Adj = AdjOf<typeof prog5>;
// Inner eqs are num/eq
const _p5c: P5Adj["c"]["kind"] = "num/eq";
const _p5f: P5Adj["f"]["kind"] = "num/eq";
// Outer eq resolves to bool/eq (children output boolean)
const _p5g: P5Adj["g"]["kind"] = "bool/eq";

// --- NEGATIVE: invalid programs produce never at the type level ---
type AssertNever<T extends never> = T;
type _Bad1 = AssertNever<AppResult<StdRegistry, ReturnType<typeof add<false, "foo">>>>;
type _Bad2 = AssertNever<AppResult<StdRegistry, ReturnType<typeof mul<ReturnType<typeof add<3, 4>>, "hello">>>>;
type _Bad3 = AssertNever<AppResult<StdRegistry, ReturnType<typeof eq<ReturnType<typeof add<3, 4>>, ReturnType<typeof eq<"a", "b">>>>>>;

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

// add(3, 4)
assert(prog1.__id === "c", "add(3,4) root is c");
assert(prog1.__adj["a"].kind === "num/literal", "a is literal");
assert(prog1.__adj["a"].out === 3, "a.out is 3");
assert(prog1.__adj["b"].kind === "num/literal", "b is literal");
assert(prog1.__adj["b"].out === 4, "b.out is 4");
assert(prog1.__adj["c"].kind === "num/add", "c is add");
assert(
  JSON.stringify(prog1.__adj["c"].children) === '["a","b"]',
  "c children are [a,b]",
);

// mul(add(3,4), 5)
assert(prog2.__id === "e", "mul root is e");
assert(Object.keys(prog2.__adj).length === 5, "5 entries");
assert(prog2.__adj["d"].out === 5, "d.out is 5");
assert(prog2.__counter === "f", "counter is f");

// eq(3, 4) → num/eq
assert(prog3.__adj["c"].kind === "num/eq", "eq(3,4) → num/eq");

// eq("hello", "world") → str/eq
assert(prog4.__adj["c"].kind === "str/eq", "eq(str,str) → str/eq");

// Nested eq → bool/eq outer
assert(prog5.__adj["g"].kind === "bool/eq", "nested eq outer is bool/eq");
assert(prog5.__adj["c"].kind === "num/eq", "nested eq inner is num/eq");

// Runtime error: add(false, "foo")
let threwType = false;
try {
  app(add(false, "foo") as any);
} catch (e: any) {
  threwType = true;
}
assert(threwType, "add(false, 'foo') throws at runtime");

// Runtime error: eq with mixed types
let threwMixed = false;
try {
  app(eq(3, "foo") as any);
} catch (e: any) {
  threwMixed = e.message.includes("different types");
}
assert(threwMixed, "eq(3, 'foo') throws for mixed types");

// ═══════════════════════════════════════════════════════════════════════
// EXTENDED REGISTRY TESTS — proves elaborator is generic, not hardcoded
// ═══════════════════════════════════════════════════════════════════════

// --- Type-level: lt(3,4) through extended registry resolves to num/lt ---
type ExtPlugins = [...typeof stdPlugins, typeof ordPlugin];
type ExtReg = RegistryOf<ExtPlugins>;
type LtResult = AppResult<ExtReg, ReturnType<typeof lt<3, 4>>>;
type LtAdj = AdjOf<LtResult>;
const _ltA: LtAdj["a"]["kind"] = "num/literal";
const _ltB: LtAdj["b"]["kind"] = "num/literal";
const _ltC: LtAdj["c"]["kind"] = "num/lt"; // resolved from "lt" trait
type LtOut = OutOf<LtResult>;
const _ltOutBool: LtOut = true;
// @ts-expect-error — boolean, not number
const _ltOutBad: LtOut = 42;

// --- Runtime: createApp with ordPlugin elaborates lt(3,4) ---
const extApp = createApp(...stdPlugins, ordPlugin);
const ltProg = extApp(lt(3, 4));
assert(ltProg.__adj[ltProg.__id].kind === "num/lt", "createApp: lt(3,4) → num/lt");
assert(Object.keys(ltProg.__adj).length === 3, "createApp: lt has 3 nodes");

// --- createApp with string lt ---
const ltStrProg = extApp(lt("a", "b"));
assert(ltStrProg.__adj[ltStrProg.__id].kind === "str/lt", "createApp: lt('a','b') → str/lt");

// --- Default app leaves lt unresolved (not in stdPlugins trait map) ---
// Type-level: AppResult<StdRegistry, lt(3,4)> = never (correctly rejected)
type _LtNever = AssertNever<AppResult<StdRegistry, ReturnType<typeof lt<3, 4>>>>;
// Runtime: passes through unresolved (permissive runtime)
const ltUnresolved: any = app(lt(3, 4) as any);
assert(
  ltUnresolved.__adj[ltUnresolved.__id].kind === "lt",
  "default app: lt stays unresolved (no trait map entry)",
);

// --- createApp still handles eq ---
const extEqProg = extApp(eq(3, 4));
assert(extEqProg.__adj[extEqProg.__id].kind === "num/eq", "createApp: eq(3,4) → num/eq");

console.log(`\n04-normalize: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
