/**
 * Expr — permissive CExpr + typed NExpr
 *
 * CExpr is maximally permissive: records kind + raw args, no validation.
 * NExpr is strict: validated adjacency map with sequential IDs.
 * app() bridges the gap (see normalize).
 */

// ─── NodeEntry: one node in the normalized adjacency map ────────────

/** A single node in the normalized adjacency map, tracking kind, children, and output type. */
export type NodeEntry<Kind extends string, ChildIDs extends string[], Out> = {
  readonly kind: Kind;
  readonly children: ChildIDs;
  readonly out: Out;
};

// ─── RuntimeEntry: untyped mirror for runtime operations ─────────────

/** Untyped mirror of NodeEntry for runtime operations. */
export interface RuntimeEntry {
  kind: string;
  children: string[];
  out: unknown;
}

// ─── CREF: unguessable brand for CExpr detection at runtime ─────────

/** Symbol brand used to detect CExpr instances at runtime. */
export const CREF = Symbol.for("mvfm/cref");

// ─── AccessorOverlay: typed property access on CExprs ────────────────

/** Overlays typed property access on CExpr for object/array output types. */
export type AccessorOverlay<O> = O extends readonly (infer E)[]
  ? { readonly [k: number]: CExpr<E, "core/access"> }
  : O extends object
    ? { readonly [K in keyof O]: CExpr<O[K], "core/access"> }
    : {};

// ─── CExpr: permissive construction-time expression ─────────────────
// O = output type (declared by constructor, validated at app() time)
// Kind = node kind string
// Args = raw arguments — CExprs, literals, records, anything
declare const cexprBrand: unique symbol;

/** Permissive construction-time expression carrying output type, kind, and raw arguments. */
export type CExpr<
  O,
  Kind extends string = string,
  Args extends readonly unknown[] = readonly unknown[],
> = {
  readonly [cexprBrand]: { readonly o: O; readonly kind: Kind; readonly args: Args };
  readonly [CREF]: true;
  readonly __kind: Kind;
  readonly __args: readonly unknown[];
  readonly __out: O;
} & AccessorOverlay<O>;

/** Create a new CExpr with the given kind and arguments (Proxy-wrapped for accessor support). */
export function makeCExpr<O, Kind extends string, Args extends readonly unknown[]>(
  kind: Kind,
  args: [...Args],
): CExpr<O, Kind, Args> {
  const raw = { [CREF]: true as const, __kind: kind, __args: args };
  const proxy: any = new Proxy(raw, {
    get(t, prop) {
      if (
        prop === CREF ||
        prop === "__kind" ||
        prop === "__args" ||
        prop === "__out" ||
        typeof prop === "symbol"
      )
        return (t as any)[prop];
      return makeCExpr("core/access" as any, [proxy, prop] as any);
    },
  });
  return proxy;
}

/** Runtime check for whether a value is a CExpr. */
export function isCExpr(x: unknown): x is CExpr<unknown> {
  return typeof x === "object" && x !== null && CREF in x && (x as any)[CREF] === true;
}

// ─── CExpr extractors ──────────────────────────────────────────────

/** Extract the output type from a CExpr. */
export type COutOf<E> = E extends CExpr<infer O, any, any> ? O : never;

/** Extract the kind string from a CExpr. */
export type CKindOf<E> = E extends CExpr<any, infer K, any> ? K : never;

/** Extract the args tuple from a CExpr. */
export type CArgsOf<E> = E extends CExpr<any, any, infer A> ? A : never;

// ─── NExpr: normalized expression ───────────────────────────────────
declare const nexprBrand: unique symbol;

/** Normalized expression with typed adjacency map, root ID, and counter state. */
export interface NExpr<O, RootId extends string, Adj, Ctr extends string> {
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

// ─── NExpr extractors ───────────────────────────────────────────────

/** Extract the root ID from an NExpr. */
export type IdOf<E> = E extends NExpr<any, infer R, any, any> ? R : never;

/** Extract the adjacency map type from an NExpr. */
export type AdjOf<E> = E extends NExpr<any, any, infer A, any> ? A : never;

/** Extract the counter state from an NExpr. */
export type CtrOf<E> = E extends NExpr<any, any, any, infer C> ? C : never;

/** Extract the output type from an NExpr. */
export type OutOf<E> = E extends NExpr<infer O, any, any, any> ? O : never;

/** Create a new NExpr with the given root ID, adjacency map, and counter. */
export function makeNExpr<O, RootId extends string, Adj, Ctr extends string>(
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
