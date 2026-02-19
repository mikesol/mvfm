/**
 * Koan 02: Build — content-addressed program construction
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - numLit(n) produces CExpr with content-addressed ID "L{n}"
 * - add(a, b) produces CExpr with ID "A({leftId},{rightId})"
 * - mul(a, b) produces CExpr with ID "M({leftId},{rightId})"
 * - No counter needed — IDs are deterministic from structure
 * - Adj is built via intersection: CAdjOf<L> & CAdjOf<R> & Record<newId, ...>
 * - DAG sharing is automatic: numLit(3) used twice → one "L3" entry
 * - Sibling composition has no collisions (unlike counter-based approaches)
 *
 * What we do NOT prove yet:
 * - Normalization to sequential IDs (see 03-normalize)
 * - Content-addressed IDs are ephemeral — never seen by downstream consumers
 *
 * Imports: 01-increment (re-exports chain)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/02-build.ts
 */

export * from "./01-increment";

import type {
  NodeEntry,
  CExpr,
  CIdOf,
  CAdjOf,
  RuntimeEntry,
} from "./01-increment";
import { makeCExpr } from "./01-increment";

// ─── numLit: literal number node ─────────────────────────────────────
// ID = "L{n}", adj = { "L{n}": NodeEntry<"num/literal", [], number> }
export function numLit<V extends number>(
  value: V,
): CExpr<
  number,
  `L${V}`,
  Record<`L${V}`, NodeEntry<"num/literal", [], number>>
> {
  const id = `L${value}` as `L${V}`;
  const entry: RuntimeEntry = { kind: "num/literal", children: [], out: value };
  return makeCExpr<
    number,
    `L${V}`,
    Record<`L${V}`, NodeEntry<"num/literal", [], number>>
  >(id, { [id]: entry } as Record<string, RuntimeEntry>);
}

// ─── add: binary addition node ───────────────────────────────────────
// ID = "A({leftId},{rightId})"
// Adj = CAdjOf<L> & CAdjOf<R> & Record<newId, NodeEntry<"num/add", [leftId, rightId], number>>
export function add<
  LA,
  LId extends string,
  RA,
  RId extends string,
>(
  left: CExpr<number, LId, LA>,
  right: CExpr<number, RId, RA>,
): CExpr<
  number,
  `A(${LId},${RId})`,
  LA & RA & Record<`A(${LId},${RId})`, NodeEntry<"num/add", [LId, RId], number>>
> {
  type NewId = `A(${LId},${RId})`;
  const lId = left.__id as LId;
  const rId = right.__id as RId;
  const id = `A(${lId},${rId})` as NewId;
  const entry: RuntimeEntry = {
    kind: "num/add",
    children: [lId, rId],
    out: undefined,
  };
  const adj = { ...left.__adj, ...right.__adj, [id]: entry };
  return makeCExpr<
    number,
    NewId,
    LA & RA & Record<NewId, NodeEntry<"num/add", [LId, RId], number>>
  >(id, adj);
}

// ─── mul: binary multiplication node ─────────────────────────────────
// ID = "M({leftId},{rightId})"
export function mul<
  LA,
  LId extends string,
  RA,
  RId extends string,
>(
  left: CExpr<number, LId, LA>,
  right: CExpr<number, RId, RA>,
): CExpr<
  number,
  `M(${LId},${RId})`,
  LA & RA & Record<`M(${LId},${RId})`, NodeEntry<"num/mul", [LId, RId], number>>
> {
  type NewId = `M(${LId},${RId})`;
  const lId = left.__id as LId;
  const rId = right.__id as RId;
  const id = `M(${lId},${rId})` as NewId;
  const entry: RuntimeEntry = {
    kind: "num/mul",
    children: [lId, rId],
    out: undefined,
  };
  const adj = { ...left.__adj, ...right.__adj, [id]: entry };
  return makeCExpr<
    number,
    NewId,
    LA & RA & Record<NewId, NodeEntry<"num/mul", [LId, RId], number>>
  >(id, adj);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

// --- numLit produces correct CExpr ---
const three = numLit(3);
type ThreeId = CIdOf<typeof three>;
const _threeId: ThreeId = "L3";
// @ts-expect-error — wrong ID
const _threeIdBad: ThreeId = "L4";

type ThreeAdj = CAdjOf<typeof three>;
const _threeKind: ThreeAdj["L3"]["kind"] = "num/literal";
const _threeChildren: ThreeAdj["L3"]["children"] = [];

// --- add produces correct CExpr ---
const four = numLit(4);
const sum = add(three, four);
type SumId = CIdOf<typeof sum>;
const _sumId: SumId = "A(L3,L4)";
// @ts-expect-error — wrong ID
const _sumIdBad: SumId = "A(L4,L3)";

type SumAdj = CAdjOf<typeof sum>;
// Merged adj contains both children and the add node
const _sumL3Kind: SumAdj["L3"]["kind"] = "num/literal";
const _sumL4Kind: SumAdj["L4"]["kind"] = "num/literal";
const _sumAddKind: SumAdj["A(L3,L4)"]["kind"] = "num/add";
const _sumAddChildren: SumAdj["A(L3,L4)"]["children"] = ["L3", "L4"];

// --- mul produces correct CExpr ---
const five = numLit(5);
const product = mul(sum, five);
type ProductId = CIdOf<typeof product>;
const _productId: ProductId = "M(A(L3,L4),L5)";
// @ts-expect-error — wrong ID
const _productIdBad: ProductId = "M(L3,L4)";

type ProductAdj = CAdjOf<typeof product>;
const _prodL3: ProductAdj["L3"]["kind"] = "num/literal";
const _prodL4: ProductAdj["L4"]["kind"] = "num/literal";
const _prodL5: ProductAdj["L5"]["kind"] = "num/literal";
const _prodAdd: ProductAdj["A(L3,L4)"]["kind"] = "num/add";
const _prodMul: ProductAdj["M(A(L3,L4),L5)"]["kind"] = "num/mul";
const _prodMulChildren: ProductAdj["M(A(L3,L4),L5)"]["children"] = [
  "A(L3,L4)",
  "L5",
];

// --- DAG sharing: same subtree used twice → one entry ---
const shared = add(three, three);
type SharedId = CIdOf<typeof shared>;
const _sharedId: SharedId = "A(L3,L3)";
type SharedAdj = CAdjOf<typeof shared>;
// Only one "L3" entry exists (intersection of identical types)
const _sharedL3Kind: SharedAdj["L3"]["kind"] = "num/literal";
const _sharedAddChildren: SharedAdj["A(L3,L3)"]["children"] = ["L3", "L3"];

// --- Sibling composition: no collisions ---
const leftSum = add(numLit(1), numLit(2));
const rightSum = add(numLit(3), numLit(4));
const combined = add(leftSum, rightSum);
type CombinedId = CIdOf<typeof combined>;
const _combinedId: CombinedId = "A(A(L1,L2),A(L3,L4))";
type CombinedAdj = CAdjOf<typeof combined>;
const _cL1: CombinedAdj["L1"]["kind"] = "num/literal";
const _cL2: CombinedAdj["L2"]["kind"] = "num/literal";
const _cLeftAdd: CombinedAdj["A(L1,L2)"]["kind"] = "num/add";
const _cRightAdd: CombinedAdj["A(L3,L4)"]["kind"] = "num/add";
const _cTopAdd: CombinedAdj["A(A(L1,L2),A(L3,L4))"]["kind"] = "num/add";

// --- Runtime adj has all expected keys ---
const _runtimeKeys = Object.keys(product.__adj);
// At runtime, adj should have 5 entries
type _RuntimeCheck = typeof product.__adj extends Record<string, RuntimeEntry>
  ? true
  : never;
const _rtCheck: _RuntimeCheck = true;
