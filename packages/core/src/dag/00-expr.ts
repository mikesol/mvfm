/**
 * Koan 00: Expr — the core phantom-typed expression
 *
 * RULE: Never rewrite this file. Later koans import from here.
 *
 * What we prove:
 * - NodeEntry<Kind, ChildIDs, Out> is the unit of the adjacency map
 * - CExpr<O, Id, Adj> is the construction-time expression (content-addressed IDs)
 * - NExpr<O, RootId, Adj, Ctr> is the normalized expression (sequential IDs)
 * - Both are phantom-branded — runtime data + compile-time DAG structure
 * - RuntimeEntry is the untyped runtime mirror of NodeEntry
 * - IdOf, AdjOf extract from either expression type
 *
 * What we do NOT prove yet:
 * - ID generation (see 01-increment)
 * - Content-addressed construction (see 02-build)
 * - Normalization (see 03-normalize)
 * - DirtyExpr (see 09-dirty)
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/00-expr.ts
 */

// ─── NodeEntry: one node in the adjacency map ────────────────────────
export type NodeEntry<
  Kind extends string,
  ChildIDs extends string[],
  Out,
> = {
  readonly kind: Kind;
  readonly children: ChildIDs;
  readonly out: Out;
};

// ─── RuntimeEntry: untyped mirror for runtime operations ─────────────
export interface RuntimeEntry {
  kind: string;
  children: string[];
  out: unknown;
}

// ─── Phantom brands ──────────────────────────────────────────────────
declare const cexprBrand: unique symbol;
declare const nexprBrand: unique symbol;

// ─── CExpr: construction-time expression (content-addressed IDs) ─────
export interface CExpr<
  O,
  Id extends string,
  Adj,
> {
  readonly [cexprBrand]: { readonly o: O; readonly id: Id; readonly adj: Adj };
  readonly __id: string;
  readonly __adj: Record<string, RuntimeEntry>;
}

// ─── NExpr: normalized expression (sequential IDs) ───────────────────
export interface NExpr<
  O,
  RootId extends string,
  Adj,
  Ctr extends string,
> {
  readonly [nexprBrand]: {
    readonly o: O;
    readonly rootId: RootId;
    readonly adj: Adj;
    readonly ctr: Ctr;
  };
  readonly __id: string;
  readonly __adj: Record<string, RuntimeEntry>;
  readonly __counter: string;
}

// ─── Extractors for CExpr ────────────────────────────────────────────
export type CIdOf<E> = E extends CExpr<any, infer Id, any> ? Id : never;
export type CAdjOf<E> = E extends CExpr<any, any, infer Adj> ? Adj : never;
export type COutOf<E> = E extends CExpr<infer O, any, any> ? O : never;

// ─── Extractors for NExpr ────────────────────────────────────────────
export type IdOf<E> =
  E extends NExpr<any, infer R, any, any> ? R : never;
export type AdjOf<E> =
  E extends NExpr<any, any, infer A, any> ? A : never;
export type CtrOf<E> =
  E extends NExpr<any, any, any, infer C> ? C : never;
export type OutOf<E> =
  E extends NExpr<infer O, any, any, any> ? O : never;

// ─── Runtime constructors ────────────────────────────────────────────
export function makeCExpr<
  O,
  Id extends string,
  Adj,
>(id: Id, adj: Record<string, RuntimeEntry>): CExpr<O, Id, Adj> {
  return { __id: id, __adj: adj } as unknown as CExpr<O, Id, Adj>;
}

export function makeNExpr<
  O,
  RootId extends string,
  Adj,
  Ctr extends string,
>(
  rootId: RootId,
  adj: Record<string, RuntimeEntry>,
  counter: Ctr,
): NExpr<O, RootId, Adj, Ctr> {
  return {
    __id: rootId,
    __adj: adj,
    __counter: counter,
  } as unknown as NExpr<O, RootId, Adj, Ctr>;
}

// ═══════════════════════════════════════════════════════════════════════
// INLINE TESTS — compile-time checks
// ═══════════════════════════════════════════════════════════════════════

// --- NodeEntry: kind, children, out are tracked ---
type TestLeaf = NodeEntry<"num/literal", [], number>;
type TestBranch = NodeEntry<"num/add", ["a", "b"], number>;

const _leafKind: TestLeaf["kind"] = "num/literal";
const _leafChildren: TestLeaf["children"] = [];
const _leafOut: TestLeaf["out"] = 42;

const _branchKind: TestBranch["kind"] = "num/add";
const _branchChildren: TestBranch["children"] = ["a", "b"];

// @ts-expect-error — wrong kind
const _wrongKind: TestLeaf["kind"] = "num/add";
// @ts-expect-error — wrong children type
const _wrongChildren: TestLeaf["children"] = ["a"];

// --- CExpr phantom branding ---
type TestCAdj = { L3: NodeEntry<"num/literal", [], number> };
type TestCExpr = CExpr<number, "L3", TestCAdj>;

// CIdOf extracts the content-addressed ID
type _CheckCId = CIdOf<TestCExpr>;
const _cid: _CheckCId = "L3";
// @ts-expect-error — wrong ID
const _cidBad: _CheckCId = "L4";

// CAdjOf extracts the adjacency map
type _CheckCAdj = CAdjOf<TestCExpr>;
const _cadj: _CheckCAdj["L3"]["kind"] = "num/literal";

// COutOf extracts the output type
type _CheckCOut = COutOf<TestCExpr>;
const _cout: _CheckCOut = 42;
// @ts-expect-error — wrong output type
const _coutBad: _CheckCOut = "not a number";

// --- NExpr phantom branding ---
type TestNAdj = {
  a: NodeEntry<"num/literal", [], number>;
  b: NodeEntry<"num/literal", [], number>;
  c: NodeEntry<"num/add", ["a", "b"], number>;
};
type TestNExpr = NExpr<number, "c", TestNAdj, "d">;

// IdOf extracts the root ID
type _CheckNId = IdOf<TestNExpr>;
const _nid: _CheckNId = "c";
// @ts-expect-error — wrong root ID
const _nidBad: _CheckNId = "a";

// AdjOf extracts the adjacency map
type _CheckNAdj = AdjOf<TestNExpr>;
const _nadjKind: _CheckNAdj["a"]["kind"] = "num/literal";
const _nadjKind2: _CheckNAdj["c"]["kind"] = "num/add";

// CtrOf extracts the counter
type _CheckCtr = CtrOf<TestNExpr>;
const _nctr: _CheckCtr = "d";
// @ts-expect-error — wrong counter
const _nctrBad: _CheckCtr = "e";

// OutOf extracts the output type
type _CheckNOut = OutOf<TestNExpr>;
const _nout: _CheckNOut = 35;
// @ts-expect-error — wrong output type
const _noutBad: _CheckNOut = "not a number";

// --- CExpr and NExpr are structurally distinct (phantom brands) ---
// CExpr cannot be assigned to NExpr and vice versa.
// We verify this by checking that the extractors return never for the wrong type.
type _CExprIdOfNever = IdOf<TestCExpr>; // should be never
type _NExprCIdOfNever = CIdOf<TestNExpr>; // should be never

type AssertNever<T extends never> = T;
type _check1 = AssertNever<_CExprIdOfNever>;
type _check2 = AssertNever<_NExprCIdOfNever>;

// --- RuntimeEntry is assignable from a concrete NodeEntry's runtime shape ---
const _re: RuntimeEntry = { kind: "num/literal", children: [], out: 3 };
const _re2: RuntimeEntry = { kind: "num/add", children: ["a", "b"], out: 7 };

// --- makeCExpr and makeNExpr produce correctly branded values ---
const testCExpr = makeCExpr<number, "L3", TestCAdj>(
  "L3",
  { L3: { kind: "num/literal", children: [], out: 3 } },
);
const _checkMakeCId: CIdOf<typeof testCExpr> = "L3";

const testNExpr = makeNExpr<number, "c", TestNAdj, "d">(
  "c",
  {
    a: { kind: "num/literal", children: [], out: 3 },
    b: { kind: "num/literal", children: [], out: 4 },
    c: { kind: "num/add", children: ["a", "b"], out: 7 },
  },
  "d",
);
const _checkMakeNId: IdOf<typeof testNExpr> = "c";
const _checkMakeNCtr: CtrOf<typeof testNExpr> = "d";
