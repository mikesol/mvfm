/**
 * Koan 04a: Structural — CExprs inside records and tuples
 *
 * Builds on 04-normalize by adding structural elaboration: records and
 * tuples that may contain CExprs. Proves that app() can walk into
 * complex structures, find CExprs inside, elaborate them, and validate
 * types against the registry. Invalid structures produce `never`.
 *
 * Record children use named maps ({x: nodeId, y: nodeId}) so the
 * representation is self-describing and order-independent. Tuples
 * use positional arrays (ordering is well-defined for tuples).
 *
 * NOTE: The type-level elaborator (ElaborateArg, ElaborateExpr,
 * ElaborateChildren) must be redefined here rather than imported from
 * 04-normalize. These types form a mutually recursive chain —
 * ElaborateArg calls ElaborateExpr, which calls ElaborateChildren,
 * which calls ElaborateArg. Changing ElaborateArg to support structural
 * cases requires the entire chain. TypeScript type aliases don't support
 * "virtual dispatch", so extension requires redefinition.
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/04a-structural.ts
 *   npx tsx spike-koans/04a-structural.ts
 */

import type {
  CExpr, NExpr, KindSpec, Increment, NeverGuard, LiftKind,
} from "./04-normalize";
import {
  makeCExpr, makeNExpr, isCExpr, incrementId, add, mul,
  LIFT_MAP, KIND_INPUTS as BASE_KIND_INPUTS,
} from "./04-normalize";

// ═══════════════════════════════════════════════════════════════════════
// LOCAL TYPES (flexible children — not constrained to string[])
// ═══════════════════════════════════════════════════════════════════════

// ChildRef: string | Record<string, ChildRef> | ChildRef[]
type SNodeEntry<Kind extends string = string, Ch = unknown, O = unknown> = {
  readonly kind: Kind; readonly children: Ch; readonly out: O;
};

// ═══════════════════════════════════════════════════════════════════════
// STRUCTURAL REGISTRY — extends StdRegistry with structural kinds
// ═══════════════════════════════════════════════════════════════════════

import type { StdRegistry } from "./04-normalize";

type StructuralRegistry = StdRegistry & {
  "geom/point": KindSpec<
    [{ x: number; y: number }], { x: number; y: number }>;
  "geom/line": KindSpec<
    [{ start: { x: number; y: number }; end: { x: number; y: number } }],
    { start: { x: number; y: number }; end: { x: number; y: number } }>;
  "data/pair": KindSpec<[[number, number]], [number, number]>;
};

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL HELPERS
// ═══════════════════════════════════════════════════════════════════════

type DeepResolve<T> =
  T extends CExpr<infer O, any, any> ? O
  : T extends readonly [] ? []
  : T extends readonly [infer H, ...infer Rest]
    ? [DeepResolve<H>, ...DeepResolve<Rest>]
  : T extends object ? { [K in keyof T]: DeepResolve<T[K]> }
  : T;

// UnionToTuple — iteration order is implementation-defined, but that's
// fine: record children are named maps, so the result is the same
// regardless of which key is processed first.
type _UTI<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I : never;
type _LastOf<U> =
  _UTI<U extends any ? () => U : never> extends () => infer R ? R : never;
type UnionToTuple<U, Last = _LastOf<U>> =
  [U] extends [never] ? [] : [...UnionToTuple<Exclude<U, Last>>, Last];

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL ELABORATOR — named children for records
// ═══════════════════════════════════════════════════════════════════════

// ElaborateArg returns [Adj, Ctr, ChildRef, OutputType]
// where ChildRef is string (leaf) | Record (named) | array (tuple).
type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  Arg extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ] ? O extends Expected ? [A2, C2, Id, O] : never : never
      >
    : [LiftKind<Expected>] extends [never]
      ? DeepResolve<Arg> extends Expected
        ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
        : never
      : Arg extends Expected
        ? [Adj & Record<Ctr, SNodeEntry<LiftKind<Expected>, [], Expected>>,
           Increment<Ctr>, Ctr, Expected]
        : DeepResolve<Arg> extends Expected
          ? ElaborateStructural<Reg, Arg, Expected, Adj, Ctr>
          : never;

// Walk a structure, returning [Adj, Ctr, ChildRef, ResolvedType]
type ElaborateStructural<
  Reg, Value, Expected, Adj, Ctr extends string,
> =
  // CExpr leaf
  Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ] ? [A2, C2, Id, O] : never
      >
    // Empty tuple
    : Value extends readonly []
      ? Expected extends readonly [] ? [Adj, Ctr, [], []] : never
    // Non-empty tuple — positional [CR, ...CRest]
    : Value extends readonly [infer H, ...infer Rest]
      ? Expected extends readonly [infer EH, ...infer ERest]
        ? NeverGuard<
            ElaborateLeaf<Reg, H, EH, Adj, Ctr>,
            ElaborateLeaf<Reg, H, EH, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer CR,
            ] ? NeverGuard<
                  ElaborateStructural<Reg, Rest, ERest, A2, C2>,
                  ElaborateStructural<Reg, Rest, ERest, A2, C2> extends [
                    infer A3, infer C3 extends string, infer CRest extends unknown[], any,
                  ] ? [A3, C3, [CR, ...CRest], Expected] : never
                > : never
          > : never
    // Record — named map {key: ChildRef}
    : Value extends object
      ? Expected extends object
        ? NeverGuard<
            ElaborateRecordFields<Reg, Value, Expected,
              UnionToTuple<keyof Expected & string> extends infer K extends string[]
                ? K : [], Adj, Ctr>,
            ElaborateRecordFields<Reg, Value, Expected,
              UnionToTuple<keyof Expected & string> extends infer K extends string[]
                ? K : [], Adj, Ctr
            > extends [infer A2, infer C2 extends string, infer Map]
              ? [A2, C2, Map, Expected] : never
          > : never
    // Primitive lift
    : Value extends number
      ? [Adj & Record<Ctr, SNodeEntry<"num/literal", [], number>>,
         Increment<Ctr>, Ctr, number]
    : Value extends string
      ? [Adj & Record<Ctr, SNodeEntry<"str/literal", [], string>>,
         Increment<Ctr>, Ctr, string]
    : Value extends boolean
      ? [Adj & Record<Ctr, SNodeEntry<"bool/literal", [], boolean>>,
         Increment<Ctr>, Ctr, boolean]
    : never;

// Iterate keys, producing {key: ChildRef, ...}
type ElaborateRecordFields<
  Reg, Value, Expected, Keys extends readonly string[],
  Adj, Ctr extends string,
> =
  Keys extends readonly []
    ? [Adj, Ctr, {}]
    : Keys extends readonly [
        infer K extends string & keyof Expected & keyof Value,
        ...infer Rest extends string[],
      ]
      ? NeverGuard<
          ElaborateLeaf<Reg, Value[K], Expected[K], Adj, Ctr>,
          ElaborateLeaf<Reg, Value[K], Expected[K], Adj, Ctr> extends [
            infer A2, infer C2 extends string, infer CR,
          ] ? NeverGuard<
                ElaborateRecordFields<Reg, Value, Expected, Rest, A2, C2>,
                ElaborateRecordFields<Reg, Value, Expected, Rest, A2, C2> extends [
                  infer A3, infer C3 extends string, infer RestMap,
                ] ? [A3, C3, Record<K, CR> & RestMap] : never
              > : never
        > : never;

// Elaborate a leaf value — returns [Adj, Ctr, ChildRef]
type ElaborateLeaf<
  Reg, Value, Expected, Adj, Ctr extends string,
> =
  Value extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ] ? O extends Expected ? [A2, C2, Id] : never : never
      >
    : [LiftKind<Expected>] extends [never]
      ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer CR, any,
        ] ? [A2, C2, CR] : never
      : Value extends Expected
        ? [Adj & Record<Ctr, SNodeEntry<LiftKind<Expected>, [], Expected>>,
           Increment<Ctr>, Ctr]
        : DeepResolve<Value> extends Expected
          ? ElaborateStructural<Reg, Value, Expected, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer CR, any,
            ] ? [A2, C2, CR] : never
          : never;

type ElaborateExpr<
  Reg, Kind extends string, Args extends readonly unknown[],
  Adj, Ctr extends string,
> =
  Kind extends keyof Reg
    ? Reg[Kind] extends KindSpec<infer Inputs extends readonly unknown[], infer O>
      ? NeverGuard<
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr>,
          ElaborateChildren<Reg, Args, Inputs, Adj, Ctr> extends [
            infer A2, infer C2 extends string, infer Ch,
          ] ? [A2 & Record<C2, SNodeEntry<Kind, Ch, O>>,
               Increment<C2>, C2, O] : never
        > : never
    : never;

// Collect per-arg ChildRefs into tuple [CR0, CR1, ...]
type ElaborateChildren<
  Reg, Args extends readonly unknown[], Expected extends readonly unknown[],
  Adj, Ctr extends string,
> =
  Args extends readonly []
    ? Expected extends readonly [] ? [Adj, Ctr, []] : never
    : Args extends readonly [infer AH, ...infer AT extends readonly unknown[]]
      ? Expected extends readonly [infer EH, ...infer ET extends readonly unknown[]]
        ? NeverGuard<
            ElaborateArg<Reg, AH, EH, Adj, Ctr>,
            ElaborateArg<Reg, AH, EH, Adj, Ctr> extends [
              infer A2, infer C2 extends string, infer CR, any,
            ] ? NeverGuard<
                  ElaborateChildren<Reg, AT, ET, A2, C2>,
                  ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                    infer A3, infer C3 extends string, infer CRest extends unknown[],
                  ] ? [A3, C3, [CR, ...CRest]] : never
                > : never
          > : never
      : never;

type AppResult<Reg, Expr> =
  Expr extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, {}, "a">,
        ElaborateExpr<Reg, K, A, {}, "a"> extends [
          infer Adj, infer C extends string, infer R extends string, infer O,
        ] ? NExpr<O, R, Adj, C> : never
      >
    : never;

// ═══════════════════════════════════════════════════════════════════════
// CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════

function point<A extends { x: unknown; y: unknown }>(
  a: A,
): CExpr<{ x: number; y: number }, "geom/point", [A]> {
  return makeCExpr("geom/point", [a]);
}

function line<A extends { start: unknown; end: unknown }>(
  a: A,
): CExpr<
  { start: { x: number; y: number }; end: { x: number; y: number } },
  "geom/line", [A]
> {
  return makeCExpr("geom/line", [a]);
}

function pair<A, B>(a: A, b: B): CExpr<[number, number], "data/pair", [[A, B]]> {
  return makeCExpr("data/pair", [[a, b]]);
}

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME: structural-aware app() with named children
// ═══════════════════════════════════════════════════════════════════════

// Extend base KIND_INPUTS with structural kinds
const KIND_INPUTS: Record<string, string[] | "structural"> = {
  ...BASE_KIND_INPUTS,
  "geom/point": "structural", "geom/line": "structural",
  "data/pair": "structural",
};
const STRUCTURAL_SHAPES: Record<string, unknown> = {
  "geom/point": { x: "number", y: "number" },
  "geom/line": { start: { x: "number", y: "number" },
                 end: { x: "number", y: "number" } },
  "data/pair": ["number", "number"],
};

type SRuntimeEntry = { kind: string; children: unknown; out: unknown };

function appS<
  Expr extends CExpr<any, string, readonly unknown[]>,
  Reg = StructuralRegistry,
>(
  expr: Expr,
): AppResult<Reg, Expr> {
  const entries: Record<string, SRuntimeEntry> = {};
  let counter = "a";
  function alloc() { const id = counter; counter = incrementId(counter); return id; }

  // Returns structured ChildRef: string | Record<string,CR> | CR[]
  function visitStructural(value: unknown, shape: unknown): unknown {
    if (isCExpr(value)) return visit(value)[0];
    if (Array.isArray(shape) && Array.isArray(value)) {
      return value.map((v, i) => visitStructural(v, shape[i]));
    }
    if (typeof shape === "object" && shape !== null && !Array.isArray(shape)) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape as object)) {
        result[key] = visitStructural(
          (value as Record<string, unknown>)[key],
          (shape as Record<string, unknown>)[key],
        );
      }
      return result;
    }
    const typeTag = typeof value;
    const liftKind = LIFT_MAP[typeTag];
    if (!liftKind) throw new Error(`Cannot lift ${typeTag}`);
    if (shape !== typeTag) throw new Error(`Expected ${shape}, got ${typeTag}`);
    const id = alloc();
    entries[id] = { kind: liftKind, children: [], out: value };
    return id;
  }

  function visit(arg: unknown): [string, string] {
    if (!isCExpr(arg)) throw new Error("visit expects CExpr");
    const cexpr = arg as CExpr<unknown>;
    const { __kind: kind, __args: args } = cexpr;
    const inputSpec = KIND_INPUTS[kind];
    if (inputSpec === "structural") {
      const childRef = visitStructural(args[0], STRUCTURAL_SHAPES[kind]);
      const id = alloc();
      entries[id] = { kind, children: [childRef], out: undefined };
      return [id, "object"];
    }
    const expectedInputs = inputSpec as string[] | undefined;
    const childIds: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const exp = expectedInputs?.[i];
      if (isCExpr(args[i])) {
        const [childId, childType] = visit(args[i]);
        if (exp && childType !== exp)
          throw new Error(`${kind}: expected ${exp} for arg ${i}, got ${childType}`);
        childIds.push(childId);
      } else {
        const typeTag = typeof args[i];
        if (exp && typeTag !== exp) throw new Error(`Expected ${exp}, got ${typeTag}`);
        const liftKind = LIFT_MAP[typeTag];
        if (!liftKind) throw new Error(`Cannot lift ${typeTag}`);
        const id = alloc();
        entries[id] = { kind: liftKind, children: [], out: args[i] };
        childIds.push(id);
      }
    }
    const id = alloc();
    entries[id] = { kind, children: childIds, out: undefined };
    return [id, kind.startsWith("num/") ? "number" : "object"];
  }

  const [rootId] = visit(expr);
  return makeNExpr(rootId, entries as any, counter) as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS — navigate by NAME, not by hardcoded node ID
// ═══════════════════════════════════════════════════════════════════════

import type { IdOf, AdjOf, OutOf } from "./04-normalize";
type AssertNever<T extends never> = T;

// p1: point({x: 3, y: 4}) — root is geom/point, children is [{x:id, y:id}]
const p1 = appS(point({ x: 3, y: 4 }));
type P1Root = AdjOf<typeof p1>[IdOf<typeof p1>];
const _p1k: P1Root["kind"] = "geom/point";

// p2: point({x: add(1,2), y: 3}) — children.x points to num/add
const p2 = appS(point({ x: add(1, 2), y: 3 }));
type P2Root = AdjOf<typeof p2>[IdOf<typeof p2>];
type P2XId = P2Root["children"] extends [{ x: infer X extends string }] ? X : never;
const _p2xk: AdjOf<typeof p2>[P2XId]["kind"] = "num/add";

// p3: pair(add(1,2), 3) — tuple children
const p3 = appS(pair(add(1, 2), 3));
type P3Root = AdjOf<typeof p3>[IdOf<typeof p3>];
const _p3k: P3Root["kind"] = "data/pair";

// p4: line({start:{x:1,y:2}, end:{x:add(3,4),y:5}})
const p4 = appS(line({ start: { x: 1, y: 2 }, end: { x: add(3, 4), y: 5 } }));
type P4Root = AdjOf<typeof p4>[IdOf<typeof p4>];
const _p4k: P4Root["kind"] = "geom/line";
// Navigate to end.x — should be num/add
type P4EndXId = P4Root["children"] extends
  [{ end: { x: infer X extends string } }] ? X : never;
const _p4exk: AdjOf<typeof p4>[P4EndXId]["kind"] = "num/add";
// Navigate to start.x — should be num/literal
type P4StartXId = P4Root["children"] extends
  [{ start: { x: infer X extends string } }] ? X : never;
const _p4sxk: AdjOf<typeof p4>[P4StartXId]["kind"] = "num/literal";

// NEGATIVE tests
type _BadPoint = AssertNever<
  AppResult<StructuralRegistry, ReturnType<typeof point<{ x: "wrong"; y: 3 }>>>
>;
type _BadNested = AssertNever<
  AppResult<StructuralRegistry, ReturnType<typeof point<{
    x: ReturnType<typeof mul<ReturnType<typeof add<1, 2>>, 3>>;
    y: ReturnType<typeof add<false, "bad">>;
  }>>>
>;

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS — navigate by name, order-independent
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error(`  FAIL: ${msg}`); }
}
function adj(p: any): Record<string, SRuntimeEntry> { return p.__adj; }
function root(p: any): SRuntimeEntry { return adj(p)[p.__id]; }

// p1: point({x: 3, y: 4})
assert(root(p1).kind === "geom/point", "p1: root is point");
const p1ch = (root(p1).children as [Record<string, string>])[0];
assert(adj(p1)[p1ch.x].kind === "num/literal", "p1: x → literal");
assert(adj(p1)[p1ch.x].out === 3, "p1: x = 3");
assert(adj(p1)[p1ch.y].kind === "num/literal", "p1: y → literal");
assert(adj(p1)[p1ch.y].out === 4, "p1: y = 4");

// p2: point({x: add(1,2), y: 3})
const p2ch = (root(p2).children as [Record<string, string>])[0];
assert(adj(p2)[p2ch.x].kind === "num/add", "p2: x → add");
assert(adj(p2)[p2ch.y].kind === "num/literal", "p2: y → literal");
assert(adj(p2)[p2ch.y].out === 3, "p2: y = 3");

// p3: pair(add(1,2), 3) — tuple children
assert(root(p3).kind === "data/pair", "p3: root is pair");
const p3ch = (root(p3).children as [string[]])[0];
assert(Array.isArray(p3ch) && p3ch.length === 2, "p3: pair tuple has 2 elts");

// p4: line — nested named records
assert(root(p4).kind === "geom/line", "p4: root is line");
const p4ch = (root(p4).children as [Record<string, Record<string, string>>])[0];
assert(adj(p4)[p4ch.end.x].kind === "num/add", "p4: end.x → add");
assert(adj(p4)[p4ch.end.y].kind === "num/literal", "p4: end.y → literal");
assert(adj(p4)[p4ch.start.x].kind === "num/literal", "p4: start.x → literal");
assert(adj(p4)[p4ch.start.x].out === 1, "p4: start.x = 1");
assert(adj(p4)[p4ch.start.y].kind === "num/literal", "p4: start.y → literal");
assert(adj(p4)[p4ch.start.y].out === 2, "p4: start.y = 2");
assert(Object.keys(adj(p4)).length === 7, "p4: 7 total nodes");

// Runtime error for invalid input
let threw = false;
try { appS(point({ x: "wrong", y: 3 }) as any); } catch { threw = true; }
assert(threw, "point({x:'wrong'}) throws at runtime");

console.log(`\n04a-structural: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
