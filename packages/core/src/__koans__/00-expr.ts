/**
 * Koan 00: Expr — permissive CExpr + typed NExpr
 *
 * CExpr is maximally permissive: records kind + raw args, no validation.
 * NExpr is strict: validated adjacency map with sequential IDs.
 * app() bridges the gap (see 04-normalize).
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/00-expr.ts
 */

// ─── NodeEntry: one node in the normalized adjacency map ────────────
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

// ─── CREF: unguessable brand for CExpr detection at runtime ─────────
export const CREF = Symbol.for("mvfm/cref");

// ─── CExpr: permissive construction-time expression ─────────────────
// O = output type (declared by constructor, validated at app() time)
// Kind = node kind string
// Args = raw arguments — CExprs, literals, records, anything
declare const cexprBrand: unique symbol;

export interface CExpr<
  O,
  Kind extends string = string,
  Args extends readonly unknown[] = readonly unknown[],
> {
  readonly [cexprBrand]: { readonly o: O; readonly kind: Kind; readonly args: Args };
  readonly [CREF]: true;
  readonly __kind: Kind;
  readonly __args: readonly unknown[];
}

export function makeCExpr<
  O,
  Kind extends string,
  Args extends readonly unknown[],
>(kind: Kind, args: [...Args]): CExpr<O, Kind, Args> {
  return {
    [CREF]: true,
    __kind: kind,
    __args: args,
  } as unknown as CExpr<O, Kind, Args>;
}

export function isCExpr(x: unknown): x is CExpr<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    CREF in x &&
    (x as any)[CREF] === true
  );
}

// ─── CExpr extractors ──────────────────────────────────────────────
export type COutOf<E> = E extends CExpr<infer O, any, any> ? O : never;
export type CKindOf<E> = E extends CExpr<any, infer K, any> ? K : never;
export type CArgsOf<E> = E extends CExpr<any, any, infer A> ? A : never;

// ─── NExpr: normalized expression (unchanged from original) ─────────
declare const nexprBrand: unique symbol;

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

// ─── NExpr extractors (unchanged) ──────────────────────────────────
export type IdOf<E> =
  E extends NExpr<any, infer R, any, any> ? R : never;
export type AdjOf<E> =
  E extends NExpr<any, any, infer A, any> ? A : never;
export type CtrOf<E> =
  E extends NExpr<any, any, any, infer C> ? C : never;
export type OutOf<E> =
  E extends NExpr<infer O, any, any, any> ? O : never;

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
// COMPILE-TIME TESTS
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

// --- CExpr: permissive, carries output type ---
const testCExpr = makeCExpr<number, "num/add", [3, 4]>("num/add", [3, 4]);
type _CheckCOut = COutOf<typeof testCExpr>;
const _cout: _CheckCOut = 42;
// @ts-expect-error — output is number, not string
const _coutBad: _CheckCOut = "nope";
type _CheckCKind = CKindOf<typeof testCExpr>;
const _ckind: _CheckCKind = "num/add";
// @ts-expect-error — wrong kind
const _ckindBad: _CheckCKind = "num/mul";
type _CheckCArgs = CArgsOf<typeof testCExpr>;
const _cargs: _CheckCArgs = [3, 4];

// --- CExpr accepts arbitrary args (validated later at app()) ---
const permissive = makeCExpr<number, "num/add", [boolean, string]>(
  "num/add", [true, "foo"],
);
// Compiles fine! Validation happens at app() time.

// --- isCExpr detection ---
const _isC: boolean = isCExpr(testCExpr);
const _isNotC: boolean = isCExpr(42);

// --- NExpr tests (same as original) ---
type TestNAdj = {
  a: NodeEntry<"num/literal", [], number>;
  b: NodeEntry<"num/literal", [], number>;
  c: NodeEntry<"num/add", ["a", "b"], number>;
};
type TestNExpr = NExpr<number, "c", TestNAdj, "d">;

type _CheckNId = IdOf<TestNExpr>;
const _nid: _CheckNId = "c";
// @ts-expect-error — wrong root ID
const _nidBad: _CheckNId = "a";

type _CheckNAdj = AdjOf<TestNExpr>;
const _nadjKind: _CheckNAdj["a"]["kind"] = "num/literal";
const _nadjKind2: _CheckNAdj["c"]["kind"] = "num/add";

type _CheckCtr = CtrOf<TestNExpr>;
const _nctr: _CheckCtr = "d";
// @ts-expect-error — wrong counter
const _nctrBad: _CheckCtr = "e";

type _CheckNOut = OutOf<TestNExpr>;
const _nout: _CheckNOut = 35;
// @ts-expect-error — wrong output type
const _noutBad: _CheckNOut = "not a number";

// --- CExpr and NExpr are structurally distinct ---
type AssertNever<T extends never> = T;
type _CExprIdOfNever = IdOf<typeof testCExpr>;
type _check1 = AssertNever<_CExprIdOfNever>;

// --- RuntimeEntry is assignable from a concrete NodeEntry ---
const _re: RuntimeEntry = { kind: "num/literal", children: [], out: 3 };
const _re2: RuntimeEntry = { kind: "num/add", children: ["a", "b"], out: 7 };
