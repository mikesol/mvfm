/**
 * Koan 04b: Accessor — proxy-based deep property access on CExprs
 *
 * Proves that a.helloRecord.boy[3].am.i[0].mean works via Proxy +
 * AccessorOverlay, producing type-safe CExpr chains.
 *
 * Gate:
 *   npx tsc --noEmit --strict spike-koans/04b-accessor.ts
 *   npx tsx spike-koans/04b-accessor.ts
 */

// ═══════════════════════════════════════════════════════════════════════
// CORE PRIMITIVES (standalone — needs own CREF for Proxy interop)
// ═══════════════════════════════════════════════════════════════════════

const CREF = Symbol("cref");

function isCExpr(x: unknown): boolean {
  return typeof x === "object" && x !== null && CREF in x;
}

function incrementId(id: string): string {
  if (id === "z") return "aa";
  const last = id.charCodeAt(id.length - 1);
  return last < 122
    ? id.slice(0, -1) + String.fromCharCode(last + 1)
    : id + "a";
}

// ═══════════════════════════════════════════════════════════════════════
// CExpr WITH ACCESSOR OVERLAY
// ═══════════════════════════════════════════════════════════════════════

type AccessorOverlay<O> =
  O extends readonly (infer E)[]
    ? { readonly [k: number]: CExpr<E, "core/access"> }
    : O extends object
      ? { readonly [K in keyof O]: CExpr<O[K], "core/access"> }
      : {};

type CExpr<
  O = unknown,
  Kind extends string = string,
  Args extends readonly unknown[] = readonly unknown[],
> = {
  readonly [CREF]: true;
  readonly __kind: Kind;
  readonly __args: Args;
  readonly __out: O; // phantom — makes O extractable for elaborator
} & AccessorOverlay<O>;

function makeCExprProxy(kind: string, args: unknown[]): any {
  const raw = { [CREF]: true as const, __kind: kind, __args: args };
  const proxy: any = new Proxy(raw, {
    get(t, prop) {
      if (
        prop === CREF || prop === "__kind" || prop === "__args" ||
        typeof prop === "symbol"
      ) return (t as any)[prop];
      return makeCExprProxy("core/access", [proxy, prop]);
    },
  });
  return proxy;
}

// ═══════════════════════════════════════════════════════════════════════
// TYPE HELPERS
// ═══════════════════════════════════════════════════════════════════════

type NeverGuard<T, Then> = [T] extends [never] ? never : Then;

type NodeEntry<
  Kind extends string = string,
  Children extends string[] = string[],
  O = unknown,
> = { kind: Kind; children: Children; out: O };

type NExpr<O, RootId extends string, Adj, Ctr extends string> = {
  __rootId: RootId; __adj: Adj; __ctr: Ctr; __out: O;
};

type KindSpec<Inputs extends readonly unknown[], O> = {
  inputs: Inputs; output: O;
};

type Increment<S extends string> =
  S extends "a" ? "b" : S extends "b" ? "c" : S extends "c" ? "d"
  : S extends "d" ? "e" : S extends "e" ? "f" : S extends "f" ? "g"
  : S extends "g" ? "h" : S extends "h" ? "i" : S extends "i" ? "j"
  : S extends "j" ? "k" : S extends "k" ? "l" : S extends "l" ? "m"
  : S extends "m" ? "n" : string;

type LiftKind<T> =
  T extends number ? "num/literal"
  : T extends string ? "str/literal"
  : T extends boolean ? "bool/literal"
  : never;

type AdjOf<T> = T extends NExpr<any, any, infer A, any> ? A : never;

// ═══════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════

type DeepRecord = {
  helloRecord: {
    boy: { am: { i: { mean: number }[] } }[];
  };
};

type TestRegistry = {
  "num/literal": KindSpec<[], number>;
  "num/add": KindSpec<[number, number], number>;
  "geom/point": KindSpec<[number, number], { x: number; y: number }>;
  "test/deep": KindSpec<[], DeepRecord>;
};

// ═══════════════════════════════════════════════════════════════════════
// TYPE-LEVEL ELABORATOR WITH ACCESSOR SUPPORT
// ═══════════════════════════════════════════════════════════════════════

type ElaborateArg<Reg, Arg, Expected, Adj, Ctr extends string> =
  // Accessor CExpr — trust O (AccessorOverlay guarantees type safety)
  Arg extends { __kind: "core/access"; __out: infer O }
    ? O extends Expected
      ? [Adj & Record<Ctr, NodeEntry<"core/access", [], O>>,
         Increment<Ctr>, [Ctr], O]
      : never
  // Regular CExpr
  : Arg extends { __kind: infer K extends string; __args: infer A extends readonly unknown[] }
    ? NeverGuard<
        ElaborateExpr<Reg, K, A, Adj, Ctr>,
        ElaborateExpr<Reg, K, A, Adj, Ctr> extends [
          infer A2, infer C2 extends string, infer Id extends string, infer O,
        ] ? O extends Expected ? [A2, C2, [Id], O] : never : never
      >
  // Raw primitive — lift
  : [LiftKind<Expected>] extends [never] ? never
    : Arg extends Expected
      ? [Adj & Record<Ctr, NodeEntry<LiftKind<Expected>, [], Expected>>,
         Increment<Ctr>, [Ctr], Expected]
      : never;

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
              infer A2, infer C2 extends string, infer Ids0 extends string[], any,
            ] ? NeverGuard<
                  ElaborateChildren<Reg, AT, ET, A2, C2>,
                  ElaborateChildren<Reg, AT, ET, A2, C2> extends [
                    infer A3, infer C3 extends string, infer Ids1 extends string[],
                  ] ? [A3, C3, [...Ids0, ...Ids1]] : never
                > : never
          > : never
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
            infer A2, infer C2 extends string, infer Ids extends string[],
          ] ? [A2 & Record<C2, NodeEntry<Kind, Ids, O>>,
               Increment<C2>, C2, O] : never
        > : never
    : never;

type AppResult<Expr> =
  Expr extends CExpr<any, infer K extends string, infer A extends readonly unknown[]>
    ? NeverGuard<
        ElaborateExpr<TestRegistry, K, A, {}, "a">,
        ElaborateExpr<TestRegistry, K, A, {}, "a"> extends [
          infer Adj, infer C extends string, infer R extends string, infer O,
        ] ? NExpr<O, R, Adj, C> : never
      >
    : never;

// ═══════════════════════════════════════════════════════════════════════
// CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════

function deepThing(): CExpr<DeepRecord, "test/deep", []> {
  return makeCExprProxy("test/deep", []);
}

function add<A, B>(a: A, b: B): CExpr<number, "num/add", [A, B]> {
  return makeCExprProxy("num/add", [a, b]);
}

function point<A, B>(
  a: A, b: B,
): CExpr<{ x: number; y: number }, "geom/point", [A, B]> {
  return makeCExprProxy("geom/point", [a, b]);
}

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME appS
// ═══════════════════════════════════════════════════════════════════════

type RuntimeEntry = { kind: string; children: string[]; out: unknown };

const LIFT_MAP: Record<string, string> = {
  number: "num/literal", string: "str/literal", boolean: "bool/literal",
};

function appS<Expr extends CExpr<any, string, readonly unknown[]>>(
  expr: Expr,
): AppResult<Expr> {
  const entries: Record<string, RuntimeEntry> = {};
  let counter = "a";

  function alloc(): string {
    const id = counter;
    counter = incrementId(counter);
    return id;
  }

  function visitAccess(arg: any): string {
    if (arg.__kind === "core/access") {
      const parentId = visitAccess(arg.__args[0]);
      const id = alloc();
      entries[id] = { kind: "core/access", children: [parentId], out: arg.__args[1] };
      return id;
    }
    return visit(arg);
  }

  function visit(arg: any): string {
    const kind: string = arg.__kind;
    const args: unknown[] = arg.__args;

    if (kind === "core/access") return visitAccess(arg);

    const childIds: string[] = [];
    for (const child of args) {
      if (isCExpr(child)) {
        childIds.push((child as any).__kind === "core/access"
          ? visitAccess(child) : visit(child as any));
      } else {
        const liftKind = LIFT_MAP[typeof child];
        if (!liftKind) throw new Error(`Cannot lift ${typeof child}`);
        const id = alloc();
        entries[id] = { kind: liftKind, children: [], out: child };
        childIds.push(id);
      }
    }
    const id = alloc();
    entries[id] = { kind, children: childIds, out: undefined };
    return id;
  }

  const rootId = visit(expr as any);
  return { __rootId: rootId, __adj: entries, __ctr: counter, __out: undefined } as any;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPILE-TIME TESTS
// ═══════════════════════════════════════════════════════════════════════

type AssertNever<T extends never> = T;

// The evil chain
const a = deepThing();
const evil = a.helloRecord.boy[3].am.i[0].mean;

// Accessor in point(x, y) — evil is CExpr<number>, add(1,2) is CExpr<number>
const p = appS(point(evil, add(1, 2)));
type PAdj = AdjOf<typeof p>;
const _pa: PAdj["a"]["kind"] = "core/access";  // accessor (opaque at type level)
const _pb: PAdj["b"]["kind"] = "num/literal";   // 1
const _pc: PAdj["c"]["kind"] = "num/literal";   // 2
const _pd: PAdj["d"]["kind"] = "num/add";       // add(1,2)
const _pe: PAdj["e"]["kind"] = "geom/point";    // point
const _pch: PAdj["e"]["children"] = ["a", "d"];

// NEGATIVE: accessor with wrong type
type _BadAccess = AssertNever<AppResult<
  ReturnType<typeof point<
    ReturnType<typeof deepThing>["helloRecord"],  // CExpr<{boy:...}> — not number!
    3
  >>
>>;

// ═══════════════════════════════════════════════════════════════════════
// RUNTIME TESTS
// ═══════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; } else { failed++; console.error(`  FAIL: ${msg}`); }
}

// Evil chain structure
assert(evil.__kind === "core/access", "evil is accessor");
assert((evil as any).__args[1] === "mean", "evil accesses 'mean'");

// Walk up the chain to count depth
let cursor: any = evil;
let depth = 0;
while (cursor.__kind === "core/access") {
  cursor = cursor.__args[0];
  depth++;
}
assert(depth === 7, "evil chain has 7 access levels");
assert(cursor.__kind === "test/deep", "chain root is test/deep");

// appS produces correct graph
const adj = p.__adj as Record<string, RuntimeEntry>;
const kinds = Object.values(adj).map(e => e.kind);
assert(kinds.includes("geom/point"), "p: has point node");
assert(kinds.includes("num/add"), "p: has add node");
assert(kinds.includes("core/access"), "p: has access nodes");
assert(kinds.includes("test/deep"), "p: has test/deep root");

// Access chain in graph: test/deep → 7 access nodes
const accessCount = kinds.filter(k => k === "core/access").length;
assert(accessCount === 7, "p: 7 access nodes for evil chain");

// Total nodes: 1 root + 7 access + 2 literals + 1 add + 1 point = 12
assert(Object.keys(adj).length === 12, "p: 12 total nodes");

// Point node children reference accessor leaf and add node
const pointNode = Object.entries(adj).find(([, e]) => e.kind === "geom/point")!;
assert(pointNode[1].children.length === 2, "point has 2 children");

console.log(`\n04b-accessor: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
