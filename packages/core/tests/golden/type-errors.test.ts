import { describe, test } from "vitest";
import {
  type AdjOf,
  type AppResult,
  add,
  addEntry,
  app,
  byKind,
  type COutOf,
  type CtrOf,
  commit,
  type DirtyAdjOf,
  dirty,
  eq,
  gc,
  type IdOf,
  mapWhere,
  mul,
  type NodeEntry,
  numLit,
  type OutOf,
  removeEntry,
  replaceWhere,
  type StdRegistry,
  sub,
  swapEntry,
} from "../../src/index";

// Helper: asserts a type is never (compile-time only)
type AssertNever<T extends never> = T;

// =========================================================================
// Expression type safety
// =========================================================================
describe("expression type safety", () => {
  test("CExpr has no IdOf — returns never", () => {
    const c = add(3, 4);
    // IdOf only works on NExpr; on CExpr it returns never
    type _Bad = AssertNever<IdOf<typeof c>>;
  });

  test("CExpr has no AdjOf — returns never", () => {
    const c = mul(add(3, 4), 5);
    type _Bad = AssertNever<AdjOf<typeof c>>;
  });

  test("CExpr has no CtrOf — returns never", () => {
    const c = sub(10, 3);
    type _Bad = AssertNever<CtrOf<typeof c>>;
  });

  test("CExpr has no OutOf — returns never", () => {
    const c = eq(3, 4);
    // OutOf extracts from NExpr brand, not CExpr
    type _Bad = AssertNever<OutOf<typeof c>>;
  });

  test("NExpr extractors do not apply to CExpr — all never", () => {
    const c = add(1, 2);
    type _Id = AssertNever<IdOf<typeof c>>;
    type _Adj = AssertNever<AdjOf<typeof c>>;
    type _Ctr = AssertNever<CtrOf<typeof c>>;
    type _Out = AssertNever<OutOf<typeof c>>;
  });

  test("COutOf extracts the declared output type from CExpr", () => {
    const c = add(3, 4);
    type Out = COutOf<typeof c>;
    const _ok: Out = 42;
    // @ts-expect-error — CExpr output is number, not string
    const _bad: Out = "nope";
  });
});

// =========================================================================
// App boundary type errors
// =========================================================================
describe("app boundary type errors", () => {
  test("add(false, 'foo') produces never via AppResult", () => {
    // add(false, "foo") — type mismatch: num/add expects [number, number]
    type _Bad = AssertNever<AppResult<StdRegistry, ReturnType<typeof add<false, "foo">>>>;
  });

  test("mul with string arg produces never via AppResult", () => {
    // mul(add(3,4), "hello") — second arg is string, not number
    type _Bad = AssertNever<
      AppResult<StdRegistry, ReturnType<typeof mul<ReturnType<typeof add<3, 4>>, "hello">>>
    >;
  });

  test("eq with mismatched types produces never via AppResult", () => {
    // eq(add(3,4), eq("a","b")) — number vs boolean
    type _Bad = AssertNever<
      AppResult<
        StdRegistry,
        ReturnType<typeof eq<ReturnType<typeof add<3, 4>>, ReturnType<typeof eq<"a", "b">>>>
      >
    >;
  });

  test("app(add(3,4)) output is number, not string", () => {
    const prog = app(add(3, 4));
    type P = OutOf<typeof prog>;
    const _ok: P = 42;
    // @ts-expect-error — number, not string
    const _bad: P = "nope";
  });

  test("app(eq(3,4)) output is boolean, not number", () => {
    const prog = app(eq(3, 4));
    type P = OutOf<typeof prog>;
    const _ok: P = true;
    // @ts-expect-error — eq output is boolean
    const _bad: P = 42;
  });
});

// =========================================================================
// DirtyExpr incompatibility
// =========================================================================
describe("DirtyExpr incompatibility", () => {
  test("DirtyExpr cannot be assigned to NExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    // @ts-expect-error — different brands, structurally incompatible
    const _incompatible: typeof prog = d;
  });

  test("only commit converts DirtyExpr back to NExpr", () => {
    const prog = app(add(3, 4));
    const d = dirty(prog);
    // commit(d) works — returns NExpr
    const n = commit(d);
    const _ok: typeof prog = n;
  });

  test("NExpr cannot be passed to commit directly", () => {
    const prog = app(add(3, 4));
    // @ts-expect-error — commit expects DirtyExpr, not NExpr
    const _bad = commit(prog);
  });
});

// =========================================================================
// Map/Replace type safety
// =========================================================================
describe("map/replace type safety", () => {
  test("mapWhere callback cannot return number as kind", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const _bad = mapWhere(prog, byKind("num/add"), (e) => ({
      // @ts-expect-error — number is not string
      kind: 42 as string,
      children: e.children,
      out: e.out,
    }));
  });

  test("mapWhere callback cannot cast children to wrong tuple", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const _bad = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      // @ts-expect-error — ["x","y"] doesn't overlap with ["a","b"]
      children: ["x", "y"] as ["a", "b"],
      out: e.out,
    }));
  });

  test("mapWhere callback cannot cast out to incompatible type", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const _bad = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      // @ts-expect-error — Error doesn't overlap with number
      out: new Error() as number,
    }));
  });

  test("replaceWhere changes kind — old kind is rejected", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const replaced = commit(replaceWhere(prog, byKind("num/add"), "num/sub"));
    type RAdj = AdjOf<typeof replaced>;
    const _ok: RAdj["c"]["kind"] = "num/sub";
    // @ts-expect-error — was "num/add", now "num/sub"
    const _bad: RAdj["c"]["kind"] = "num/add";
  });
});

// =========================================================================
// Type utilities on NExpr
// =========================================================================
describe("NExpr type utilities", () => {
  test("IdOf returns correct root ID", () => {
    const prog = app(add(3, 4));
    type Id = IdOf<typeof prog>;
    const _ok: Id = "c";
    // @ts-expect-error — wrong root ID
    const _bad: Id = "a";
  });

  test("OutOf returns correct output type", () => {
    const prog = app(mul(add(3, 4), 5));
    type O = OutOf<typeof prog>;
    const _ok: O = 42;
    // @ts-expect-error — number, not string
    const _bad: O = "nope";
  });

  test("CtrOf returns correct counter", () => {
    const prog = app(mul(add(3, 4), 5));
    type C = CtrOf<typeof prog>;
    const _ok: C = "f";
    // @ts-expect-error — wrong counter
    const _bad: C = "z";
  });

  test("AdjOf tracks node kinds precisely", () => {
    const prog = app(mul(add(3, 4), 5));
    type Adj = AdjOf<typeof prog>;
    const _a: Adj["a"]["kind"] = "num/literal";
    const _c: Adj["c"]["kind"] = "num/add";
    const _e: Adj["e"]["kind"] = "num/mul";
  });
});

// =========================================================================
// Dirty operation type tracking
// =========================================================================
describe("dirty operation type tracking", () => {
  test("removeEntry removes key from adj type", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    const d2 = removeEntry(d, "a");
    type D2Adj = DirtyAdjOf<typeof d2>;
    // @ts-expect-error — "a" has been removed
    type _bad = D2Adj["a"]["kind"];
  });

  test("swapEntry changes the kind in adj type", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    const d2 = swapEntry(d, "c", {
      kind: "num/sub" as const,
      children: ["a", "b"] as ["a", "b"],
      out: 0 as number,
    } as const);
    type D2Adj = DirtyAdjOf<typeof d2>;
    const _ok: D2Adj["c"]["kind"] = "num/sub";
    // @ts-expect-error — was swapped from "num/add"
    const _bad: D2Adj["c"]["kind"] = "num/add";
  });

  test("gc removes orphan from adj type", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const withOrphan = addEntry(dirty(prog), "orphan", {
      kind: "dead" as const,
      children: [] as const,
      out: undefined,
    });
    const cleaned = commit(gc(withOrphan));
    type CleanAdj = AdjOf<typeof cleaned>;
    // @ts-expect-error — orphan was gc'd
    type _bad = CleanAdj["orphan"]["kind"];
  });
});

// =========================================================================
// NodeEntry field constraints
// =========================================================================
describe("NodeEntry field constraints", () => {
  test("wrong kind literal is rejected", () => {
    type Leaf = NodeEntry<"num/literal", [], number>;
    // @ts-expect-error — wrong kind
    const _bad: Leaf["kind"] = "num/add";
  });

  test("wrong children type is rejected", () => {
    type Leaf = NodeEntry<"num/literal", [], number>;
    // @ts-expect-error — wrong children type
    const _bad: Leaf["children"] = ["a"];
  });
});
