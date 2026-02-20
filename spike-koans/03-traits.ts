/**
 * Koan 03: Traits — typeclass-style polymorphism over CExpr
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - strLit(s) produces CExpr<string, ...> alongside numLit's CExpr<number, ...>
 * - boolLit(b) produces CExpr<boolean, ...> for a third type
 * - A TraitInstance links a phantom type (number/string) to a node kind ("num/eq")
 * - composeEq() builds a polymorphic eq from trait instances
 * - Positive: eq(numLit(3), numLit(4)) typechecks, produces "num/eq" kind
 * - Positive: eq(strLit("a"), strLit("b")) typechecks, produces "str/eq" kind
 * - Negative: eq(numLit(3), strLit("b")) is a compile error (NoInfer)
 * - Negative: eq with no instances → never-typed, unusable
 * - The returned CExpr<boolean> carries the correct specialized kind in its adj
 * - Runtime dispatch picks the right constructor via kind prefix matching
 * - mvfm() composes plugins into a $ record with constructors + trait dispatchers
 *
 * What we do NOT prove yet:
 * - Normalization or DAG operations (see 04-normalize onward)
 *
 * Imports: 02-build (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/03-traits.ts
 */

export * from "./02-build";

import type {
  NodeEntry,
  CExpr,
  CIdOf,
  CAdjOf,
  COutOf,
  RuntimeEntry,
} from "./02-build";
import { makeCExpr, numLit, add } from "./02-build";

// ─── strLit: string literal node ────────────────────────────────────
export function strLit<V extends string>(
  value: V,
): CExpr<
  string,
  `S${V}`,
  Record<`S${V}`, NodeEntry<"str/literal", [], string>>
> {
  const id = `S${value}` as `S${V}`;
  const entry: RuntimeEntry = { kind: "str/literal", children: [], out: value };
  return makeCExpr<
    string,
    `S${V}`,
    Record<`S${V}`, NodeEntry<"str/literal", [], string>>
  >(id, { [id]: entry } as Record<string, RuntimeEntry>, "string");
}

// ─── boolLit: boolean literal node ──────────────────────────────────
export function boolLit<V extends boolean>(
  value: V,
): CExpr<
  boolean,
  `B${V}`,
  Record<`B${V}`, NodeEntry<"bool/literal", [], boolean>>
> {
  const id = `B${value}` as `B${V}`;
  const entry: RuntimeEntry = { kind: "bool/literal", children: [], out: value };
  return makeCExpr<
    boolean,
    `B${V}`,
    Record<`B${V}`, NodeEntry<"bool/literal", [], boolean>>
  >(id, { [id]: entry } as Record<string, RuntimeEntry>, "boolean");
}

// ─── Concrete eq constructors (per-type) ────────────────────────────
// These are the "instance methods" — each one knows how to build an eq
// node for a specific type. They are NOT exported as public API; the
// composed `eq` is what users call.

function numEq<
  LId extends string, LAdj,
  RId extends string, RAdj,
>(
  left: CExpr<number, LId, LAdj>,
  right: CExpr<number, RId, RAdj>,
): CExpr<
  boolean,
  `E(${LId},${RId})`,
  LAdj & RAdj & Record<`E(${LId},${RId})`, NodeEntry<"num/eq", [LId, RId], boolean>>
> {
  const lId = left.__id as LId;
  const rId = right.__id as RId;
  const id = `E(${lId},${rId})` as `E(${LId},${RId})`;
  const entry: RuntimeEntry = { kind: "num/eq", children: [lId, rId], out: undefined };
  const adj = { ...left.__adj, ...right.__adj, [id]: entry };
  return makeCExpr(id, adj, "boolean");
}

function strEq<
  LId extends string, LAdj,
  RId extends string, RAdj,
>(
  left: CExpr<string, LId, LAdj>,
  right: CExpr<string, RId, RAdj>,
): CExpr<
  boolean,
  `E(${LId},${RId})`,
  LAdj & RAdj & Record<`E(${LId},${RId})`, NodeEntry<"str/eq", [LId, RId], boolean>>
> {
  const lId = left.__id as LId;
  const rId = right.__id as RId;
  const id = `E(${lId},${rId})` as `E(${LId},${RId})`;
  const entry: RuntimeEntry = { kind: "str/eq", children: [lId, rId], out: undefined };
  const adj = { ...left.__adj, ...right.__adj, [id]: entry };
  return makeCExpr(id, adj, "boolean");
}

function boolEq<
  LId extends string, LAdj,
  RId extends string, RAdj,
>(
  left: CExpr<boolean, LId, LAdj>,
  right: CExpr<boolean, RId, RAdj>,
): CExpr<
  boolean,
  `E(${LId},${RId})`,
  LAdj & RAdj & Record<`E(${LId},${RId})`, NodeEntry<"bool/eq", [LId, RId], boolean>>
> {
  const lId = left.__id as LId;
  const rId = right.__id as RId;
  const id = `E(${lId},${rId})` as `E(${LId},${RId})`;
  const entry: RuntimeEntry = { kind: "bool/eq", children: [lId, rId], out: undefined };
  const adj = { ...left.__adj, ...right.__adj, [id]: entry };
  return makeCExpr(id, adj, "boolean");
}

// ═══════════════════════════════════════════════════════════════════════
// TRAIT MACHINERY
// ═══════════════════════════════════════════════════════════════════════

// ─── TraitInstance: links a phantom type to a node kind ─────────────
// "For type ForType, the eq operation produces nodes of kind Kind"
export interface TraitInstance<
  ForType,
  Kind extends string,
> {
  readonly _forType: ForType; // phantom — never read at runtime
  readonly kind: Kind;
  readonly forTypeTag: string; // runtime: matches CExpr.__outType (e.g., "number", "boolean")
  readonly ctor: (left: CExpr<any, any, any>, right: CExpr<any, any, any>) => CExpr<any, any, any>;
}

// ─── Type-level machinery ───────────────────────────────────────────

// Extract the union of types supported by a set of instances
type SupportedTypes<Instances> =
  Instances extends TraitInstance<infer T, any> ? T : never;

// Resolve the node kind for a given output type O against instances.
// Uses bidirectional extends to require exact type match (not a union).
type ResolveKind<O, Instances> =
  Instances extends TraitInstance<infer T, infer K>
    ? O extends T ? T extends O ? K : never : never
    : never;

// ─── ComposedEq: the polymorphic eq function type ───────────────────
// O is inferred from `left`. NoInfer<O> on `right` prevents TypeScript
// from widening O to a union (e.g., number | string) when the arguments
// have different types — that would be a type error, not a valid call.
export interface ComposedEq<Instances> {
  <
    O extends SupportedTypes<Instances>,
    LId extends string, LAdj,
    RId extends string, RAdj,
  >(
    left: CExpr<O, LId, LAdj>,
    right: CExpr<NoInfer<O>, RId, RAdj>,
  ): CExpr<
    boolean,
    `E(${LId},${RId})`,
    LAdj & RAdj & Record<
      `E(${LId},${RId})`,
      NodeEntry<ResolveKind<O, Instances>, [LId, RId], boolean>
    >
  >;
}

// ─── composeEq: build a polymorphic eq from instances ───────────────
export function composeEq<
  const I extends readonly TraitInstance<any, any>[],
>(instances: I): ComposedEq<I[number]> {
  return ((left: any, right: any) => {
    const outType = left.__outType as string;
    const inst = instances.find((i) => i.forTypeTag === outType);
    if (!inst) {
      throw new Error(`No eq instance for output type: ${outType}`);
    }
    return inst.ctor(left, right);
  }) as ComposedEq<I[number]>;
}

// ═══════════════════════════════════════════════════════════════════════
// PLUGIN & MVFM COMPOSITION
// ═══════════════════════════════════════════════════════════════════════

// A plugin bundles constructors + trait instances
export interface PluginShape<
  Ctors extends Record<string, (...args: any[]) => any>,
  Instances extends readonly TraitInstance<any, any>[],
> {
  readonly ctors: Ctors;
  readonly instances: Instances;
}

// Collect all instances from a tuple of plugins
type CollectInstances<Plugins extends readonly PluginShape<any, any>[]> =
  Plugins[number]["instances"][number];

// UnionToIntersection: converts A | B into A & B
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never;

// Merge all constructor records from a tuple of plugins (intersection, not union)
type MergeCtors<Plugins extends readonly PluginShape<any, any>[]> =
  UnionToIntersection<Plugins[number]["ctors"]>;

// The $ object: all constructors + trait dispatchers
type DollarSign<Plugins extends readonly PluginShape<any, any>[]> =
  MergeCtors<Plugins> & { eq: ComposedEq<CollectInstances<Plugins>> };

// mvfm: compose plugins into $
export function mvfm<
  const P extends readonly PluginShape<any, any>[],
>(...plugins: P): DollarSign<P> {
  const allCtors: Record<string, unknown> = {};
  const allInstances: TraitInstance<any, any>[] = [];

  for (const plugin of plugins) {
    Object.assign(allCtors, plugin.ctors);
    allInstances.push(...plugin.instances);
  }

  const eq = composeEq(allInstances);
  return { ...allCtors, eq } as DollarSign<P>;
}

// ═══════════════════════════════════════════════════════════════════════
// PLUGIN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

export const numEqInstance: TraitInstance<number, "num/eq"> = {
  _forType: 0 as unknown as number,
  kind: "num/eq",
  forTypeTag: "number",
  ctor: numEq,
};

export const strEqInstance: TraitInstance<string, "str/eq"> = {
  _forType: "" as unknown as string,
  kind: "str/eq",
  forTypeTag: "string",
  ctor: strEq,
};

export const boolEqInstance: TraitInstance<boolean, "bool/eq"> = {
  _forType: false as unknown as boolean,
  kind: "bool/eq",
  forTypeTag: "boolean",
  ctor: boolEq,
};

const numPlugin = {
  ctors: { numLit, add },
  instances: [numEqInstance] as const,
} satisfies PluginShape<any, readonly TraitInstance<any, any>[]>;

const strPlugin = {
  ctors: { strLit },
  instances: [strEqInstance] as const,
} satisfies PluginShape<any, readonly TraitInstance<any, any>[]>;

const boolPlugin = {
  ctors: { boolLit },
  instances: [boolEqInstance] as const,
} satisfies PluginShape<any, readonly TraitInstance<any, any>[]>;

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// ─── strLit produces correct CExpr ──────────────────────────────────
const hello = strLit("hello");
type HelloId = CIdOf<typeof hello>;
const _helloId: HelloId = "Shello";
// @ts-expect-error — wrong ID
const _helloIdBad: HelloId = "Sworld";

type HelloAdj = CAdjOf<typeof hello>;
const _helloKind: HelloAdj["Shello"]["kind"] = "str/literal";
type HelloOut = COutOf<typeof hello>;
const _helloOut: HelloOut = "any string";
// @ts-expect-error — string, not number
const _helloOutBad: HelloOut = 42;

// ─── boolLit produces correct CExpr ─────────────────────────────────
const yes = boolLit(true);
type YesId = CIdOf<typeof yes>;
const _yesId: YesId = "Btrue";
type YesOut = COutOf<typeof yes>;
const _yesOut: YesOut = false; // boolean type, any bool value

// ─── composeEq: basic composition ───────────────────────────────────
const eq2 = composeEq([numEqInstance, strEqInstance] as const);

// Positive: eq(numLit, numLit) → CExpr<boolean> with "num/eq" kind
const eqNums = eq2(numLit(3), numLit(4));
type EqNumsId = CIdOf<typeof eqNums>;
const _eqNumsId: EqNumsId = "E(L3,L4)";
type EqNumsAdj = CAdjOf<typeof eqNums>;
const _eqNumsKind: EqNumsAdj["E(L3,L4)"]["kind"] = "num/eq";
// @ts-expect-error — kind is "num/eq", not "str/eq"
const _eqNumsKindBad: EqNumsAdj["E(L3,L4)"]["kind"] = "str/eq";
type EqNumsOut = COutOf<typeof eqNums>;
const _eqNumsOut: EqNumsOut = true; // boolean

// Positive: eq(strLit, strLit) → CExpr<boolean> with "str/eq" kind
const eqStrs = eq2(strLit("a"), strLit("b"));
type EqStrsAdj = CAdjOf<typeof eqStrs>;
const _eqStrsKind: EqStrsAdj["E(Sa,Sb)"]["kind"] = "str/eq";
// @ts-expect-error — kind is "str/eq", not "num/eq"
const _eqStrsKindBad: EqStrsAdj["E(Sa,Sb)"]["kind"] = "num/eq";

// Children are tracked in the eq node's adj
const _eqNumsChildren: EqNumsAdj["E(L3,L4)"]["children"] = ["L3", "L4"];
// Operand adj entries are merged in
const _eqNumsL3: EqNumsAdj["L3"]["kind"] = "num/literal";
const _eqNumsL4: EqNumsAdj["L4"]["kind"] = "num/literal";

// ─── Composition: eq result feeds into further expressions ──────────
// eq produces CExpr<boolean>, which can't be passed to add (wants number)
// @ts-expect-error — boolean CExpr can't go where number CExpr is expected
const _badCompose = add(eqNums, numLit(5));

// ─── mvfm: plugin composition ───────────────────────────────────────
const $ = mvfm(numPlugin, strPlugin);

// $ has constructors from both plugins
const n = $.numLit(10);
const s = $.strLit("hi");

// $ has composed eq that accepts both types
const eqN = $.eq($.numLit(1), $.numLit(2));
const eqS = $.eq($.strLit("x"), $.strLit("y"));

// Kind is correctly specialized per call site
type EqNAdj = CAdjOf<typeof eqN>;
const _eqNKind: EqNAdj["E(L1,L2)"]["kind"] = "num/eq";
type EqSAdj = CAdjOf<typeof eqS>;
const _eqSKind: EqSAdj["E(Sx,Sy)"]["kind"] = "str/eq";

// ─── mvfm with three plugins ───────────────────────────────────────
const $3 = mvfm(numPlugin, strPlugin, boolPlugin);
const eqB = $3.eq(boolLit(true), boolLit(false));
type EqBAdj = CAdjOf<typeof eqB>;
const _eqBKind: EqBAdj["E(Btrue,Bfalse)"]["kind"] = "bool/eq";

// ─── NEGATIVE TYPE-LEVEL PROOFS ─────────────────────────────────────
// These live in a dead function so they're checked by tsc but never run.
// (Calling eq with wrong types would also throw at runtime, but we want
// to prove the errors are caught at COMPILE TIME, not runtime.)
function _negativeProofs(): never {
  // Mixed types: eq(numLit, strLit) → compile error via NoInfer
  // @ts-expect-error — number ≠ string
  eq2(numLit(3), strLit("b"));
  // @ts-expect-error — string ≠ number (reversed)
  eq2(strLit("a"), numLit(4));

  // composeEq with no instances → SupportedTypes = never → unusable
  const eqEmpty = composeEq([] as const);
  // @ts-expect-error — never is not satisfiable
  eqEmpty(numLit(3), numLit(4));

  // mvfm mixed types rejected
  // @ts-expect-error — number ≠ string
  $.eq($.numLit(1), $.strLit("x"));
  // @ts-expect-error — bool ≠ number
  $3.eq(boolLit(true), numLit(1));

  // eq only accepts registered types
  const $numOnly = mvfm(numPlugin);
  // @ts-expect-error — string not registered
  $numOnly.eq(strLit("a"), strLit("b"));

  throw new Error("unreachable");
}

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// ─── Invariant: __outType matches the declared phantom O for every ctor ─
function assertOutType(
  expr: { __outType: string },
  expected: string,
  label: string,
): void {
  console.assert(
    expr.__outType === expected,
    `${label}: __outType should be "${expected}", got "${expr.__outType}"`,
  );
}

// Literals
assertOutType(numLit(1), "number", "numLit");
assertOutType(strLit("a"), "string", "strLit");
assertOutType(boolLit(true), "boolean", "boolLit");

// Arithmetic (output stays number)
assertOutType(add(numLit(1), numLit(2)), "number", "add");

// Eq (output is ALWAYS boolean, regardless of input type)
assertOutType(eq2(numLit(1), numLit(2)), "boolean", "numEq");
assertOutType(eq2(strLit("a"), strLit("b")), "boolean", "strEq");

// Composed via mvfm
const rt$ = mvfm(numPlugin, strPlugin, boolPlugin);
assertOutType(rt$.eq(numLit(1), numLit(2)), "boolean", "mvfm numEq");
assertOutType(rt$.eq(strLit("a"), strLit("b")), "boolean", "mvfm strEq");
assertOutType(rt$.eq(boolLit(true), boolLit(false)), "boolean", "mvfm boolEq");

// Depth-2 crossing: eq output feeds back into eq
assertOutType(
  rt$.eq(rt$.eq(numLit(1), numLit(2)), rt$.eq(numLit(3), numLit(4))),
  "boolean",
  "nested eq(eq,eq)",
);

// Runtime dispatch: eq picks the right constructor based on __outType
const rtEqNum = eq2(numLit(3), numLit(4));
const rtNumEntry = rtEqNum.__adj[rtEqNum.__id] as RuntimeEntry;
console.assert(rtNumEntry.kind === "num/eq", `expected num/eq, got ${rtNumEntry.kind}`);
console.assert(rtNumEntry.children.length === 2, "eq node has 2 children");

const rtEqStr = eq2(strLit("a"), strLit("b"));
const rtStrEntry = rtEqStr.__adj[rtEqStr.__id] as RuntimeEntry;
console.assert(rtStrEntry.kind === "str/eq", `expected str/eq, got ${rtStrEntry.kind}`);

// Runtime: mvfm-composed eq dispatches correctly
const rt$2 = mvfm(numPlugin, strPlugin, boolPlugin);
const rtMvfmNum = rt$2.eq(numLit(5), numLit(6));
console.assert(
  (rtMvfmNum.__adj[rtMvfmNum.__id] as RuntimeEntry).kind === "num/eq",
  "mvfm eq dispatches to num/eq",
);
const rtMvfmStr = rt$2.eq(strLit("x"), strLit("y"));
console.assert(
  (rtMvfmStr.__adj[rtMvfmStr.__id] as RuntimeEntry).kind === "str/eq",
  "mvfm eq dispatches to str/eq",
);
const rtMvfmBool = rt$2.eq(boolLit(true), boolLit(false));
console.assert(
  (rtMvfmBool.__adj[rtMvfmBool.__id] as RuntimeEntry).kind === "bool/eq",
  "mvfm eq dispatches to bool/eq",
);

// Runtime: composeEq with no matching instance throws
let threwNoInstance = false;
try {
  const eqNumOnly = composeEq([numEqInstance] as const);
  // Force runtime dispatch with a str node (bypassing types via any)
  (eqNumOnly as any)(strLit("a"), strLit("b"));
} catch (e: any) {
  threwNoInstance = e.message.includes("No eq instance");
}
console.assert(threwNoInstance, "composeEq throws for unregistered type at runtime");

// ─── Nested eq: eq(eq(num,num), eq(num,num)) → bool/eq ──────────────
// eq produces CExpr<boolean>, so nesting dispatches to boolEq at runtime
const rtInner1 = rt$2.eq(numLit(3), numLit(4));
const rtInner2 = rt$2.eq(numLit(5), numLit(6));
const rtNested = rt$2.eq(rtInner1, rtInner2);

// Runtime: outer eq should use bool/eq (not num/eq!)
const rtNestedEntry = rtNested.__adj[rtNested.__id] as RuntimeEntry;
console.assert(
  rtNestedEntry.kind === "bool/eq",
  `nested eq: expected bool/eq, got ${rtNestedEntry.kind}`,
);
// Inner eq nodes should still be num/eq
console.assert(
  (rtNested.__adj[rtInner1.__id] as RuntimeEntry).kind === "num/eq",
  "nested eq: inner1 is num/eq",
);
console.assert(
  (rtNested.__adj[rtInner2.__id] as RuntimeEntry).kind === "num/eq",
  "nested eq: inner2 is num/eq",
);

// Compile-time: verify nested eq produces bool/eq in the adj
type NestedEqAdj = CAdjOf<typeof rtNested>;
type NestedOuterKind = NestedEqAdj["E(E(L3,L4),E(L5,L6))"]["kind"];
const _nestedOuterKind: NestedOuterKind = "bool/eq";
// @ts-expect-error — outer kind is bool/eq, not num/eq
const _nestedOuterKindBad: NestedOuterKind = "num/eq";

// Compile-time: inner eq nodes still have num/eq
const _nestedInner1Kind: NestedEqAdj["E(L3,L4)"]["kind"] = "num/eq";
const _nestedInner2Kind: NestedEqAdj["E(L5,L6)"]["kind"] = "num/eq";

// __outType of nested eq is "boolean" (eq always outputs boolean)
console.assert(
  rtNested.__outType === "boolean",
  `nested eq: __outType should be "boolean", got "${rtNested.__outType}"`,
);

console.log("03-traits: all assertions passed");
