/**
 * Core API gates (00-05): expr, increment, build, traits, composition, predicates.
 */
import { describe, expect, test } from "vitest";
import {
  add,
  and,
  app,
  boolLit,
  buildKindInputs,
  buildLiftMap,
  buildTraitMap,
  byKind,
  byKindGlob,
  byName,
  createApp,
  eq,
  hasChildCount,
  incrementId,
  isCExpr,
  isLeaf,
  lt,
  makeCExpr,
  mul,
  mvfmU,
  not,
  numLit,
  or,
  ordPlugin,
  stdPlugins,
  strLit,
  sub,
} from "../src/index";

// =====================================================================
// 00-expr: compile-time only — placeholder proving types exist
// =====================================================================
describe("00-expr (types exist)", () => {
  test("CExpr and NExpr types are importable and constructible", () => {
    const c = makeCExpr<number, "num/add", [3, 4]>("num/add", [3, 4]);
    expect(isCExpr(c)).toBe(true);
    expect(isCExpr(42)).toBe(false);
    expect(c.__kind).toBe("num/add");
  });
});

// =====================================================================
// 01-increment: runtime incrementId assertions
// =====================================================================
describe("01-increment", () => {
  test("non-carry increments", () => {
    expect(incrementId("a")).toBe("b");
    expect(incrementId("b")).toBe("c");
    expect(incrementId("m")).toBe("n");
    expect(incrementId("y")).toBe("z");
  });

  test("single carry z -> aa", () => {
    expect(incrementId("z")).toBe("aa");
  });

  test("carry with prefix", () => {
    expect(incrementId("az")).toBe("ba");
    expect(incrementId("bz")).toBe("ca");
    expect(incrementId("yz")).toBe("za");
  });

  test("multi carry", () => {
    expect(incrementId("zz")).toBe("aaa");
    expect(incrementId("zzz")).toBe("aaaa");
  });

  test("non-carry multi-char", () => {
    expect(incrementId("aa")).toBe("ab");
    expect(incrementId("ab")).toBe("ac");
    expect(incrementId("ay")).toBe("az");
  });

  test("chain a through z and beyond", () => {
    const expected = [
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "q",
      "r",
      "s",
      "t",
      "u",
      "v",
      "w",
      "x",
      "y",
      "z",
      "aa",
      "ab",
      "ac",
    ];
    let id = "a";
    for (const exp of expected) {
      id = incrementId(id);
      expect(id).toBe(exp);
    }
  });
});

// =====================================================================
// 02-build: compile-time only — placeholder proving constructors exist
// =====================================================================
describe("02-build (types exist)", () => {
  test("constructors produce CExprs with correct __kind", () => {
    expect(add(3, 4).__kind).toBe("num/add");
    expect(mul(3, 4).__kind).toBe("num/mul");
    expect(sub(3, 4).__kind).toBe("num/sub");
    expect(eq(3, 4).__kind).toBe("eq");
    expect(numLit(3)).toBe(3);
    expect(strLit("hi")).toBe("hi");
    expect(boolLit(true)).toBe(true);
  });
});

// =====================================================================
// 03-traits: compile-time only for trait types; runtime for plugin bag
// =====================================================================
describe("03-traits (types exist)", () => {
  test("mvfm bag contains constructors", () => {
    // mvfmU tests are in 03a-composition below
    const c = eq(3, 4);
    expect(c.__kind).toBe("eq");
  });
});

// =====================================================================
// 03a-composition: runtime map builders + mvfmU
// =====================================================================
describe("03a-composition", () => {
  test("buildLiftMap from stdPlugins", () => {
    const lm = buildLiftMap(stdPlugins);
    expect(lm.number).toBe("num/literal");
    expect(lm.string).toBe("str/literal");
    expect(lm.boolean).toBe("bool/literal");
    expect(Object.keys(lm).length).toBe(3);
  });

  test("buildTraitMap from stdPlugins", () => {
    const tm = buildTraitMap(stdPlugins);
    expect(tm.eq.number).toBe("num/eq");
    expect(tm.eq.string).toBe("str/eq");
    expect(tm.eq.boolean).toBe("bool/eq");
  });

  test("buildKindInputs from stdPlugins", () => {
    const ki = buildKindInputs(stdPlugins);
    expect(ki["num/add"]).toEqual(["number", "number"]);
    expect(ki["str/eq"]).toEqual(["string", "string"]);
    expect(ki["num/literal"]).toEqual([]);
  });

  test("extended ord plugin extends trait/kind maps", () => {
    const extPlugins = [...stdPlugins, ordPlugin] as const;
    const tmExt = buildTraitMap(extPlugins);
    expect(tmExt.lt.number).toBe("num/lt");
    expect(tmExt.lt.string).toBe("str/lt");
    expect(tmExt.eq.number).toBe("num/eq");
    const kiExt = buildKindInputs(extPlugins);
    expect(kiExt["num/lt"]).toEqual(["number", "number"]);
  });

  test("mvfmU produces working constructors", () => {
    const $std = mvfmU(...stdPlugins);
    expect($std.add(1, 2).__kind).toBe("num/add");
    expect($std.eq(3, 4).__kind).toBe("eq");
    const $ext = mvfmU(...stdPlugins, ordPlugin);
    expect($ext.lt(3, 4).__kind).toBe("lt");
    expect($ext.eq(3, 4).__kind).toBe("eq");
  });

  test("mvfmU multi-type simultaneous", () => {
    const $all = mvfmU(...stdPlugins);
    expect($all.add(1, 2).__kind).toBe("num/add");
    expect($all.strLit("hi")).toBe("hi");
    expect($all.eq(1, 2).__kind).toBe("eq");
    expect($all.eq("a", "b").__kind).toBe("eq");
    expect($all.eq(true, false).__kind).toBe("eq");
  });
});

// =====================================================================
// 04-normalize: app() elaboration
// =====================================================================
describe("04-normalize", () => {
  const prog1 = app(add(3, 4));
  const prog2 = app(mul(add(3, 4), 5));
  const prog3 = app(eq(3, 4));
  const prog4 = app(eq("hello", "world"));
  const prog5 = app(eq(eq(3, 3), eq(5, 5)));

  test("add(3,4) root structure", () => {
    expect(prog1.__id).toBe("c");
    expect(prog1.__adj.a.kind).toBe("num/literal");
    expect(prog1.__adj.a.out).toBe(3);
    expect(prog1.__adj.b.kind).toBe("num/literal");
    expect(prog1.__adj.b.out).toBe(4);
    expect(prog1.__adj.c.kind).toBe("num/add");
    expect(prog1.__adj.c.children).toEqual(["a", "b"]);
  });

  test("mul(add(3,4),5) has 5 entries, root e, counter f", () => {
    expect(prog2.__id).toBe("e");
    expect(Object.keys(prog2.__adj).length).toBe(5);
    expect(prog2.__adj.d.out).toBe(5);
    expect(prog2.__counter).toBe("f");
  });

  test("eq(3,4) resolves to num/eq", () => {
    expect(prog3.__adj.c.kind).toBe("num/eq");
  });

  test("eq(str,str) resolves to str/eq", () => {
    expect(prog4.__adj.c.kind).toBe("str/eq");
  });

  test("nested eq resolves to bool/eq outer", () => {
    expect(prog5.__adj.g.kind).toBe("bool/eq");
    expect(prog5.__adj.c.kind).toBe("num/eq");
  });

  test("add(false,'foo') throws at runtime", () => {
    expect(() => app(add(false, "foo") as any)).toThrow();
  });

  test("eq(3,'foo') throws for mixed types", () => {
    expect(() => app(eq(3, "foo") as any)).toThrow(/different types/);
  });

  test("createApp with ordPlugin elaborates lt", () => {
    const extApp = createApp(...stdPlugins, ordPlugin);
    const ltProg = extApp(lt(3, 4));
    expect(ltProg.__adj[ltProg.__id].kind).toBe("num/lt");
    expect(Object.keys(ltProg.__adj).length).toBe(3);
    const ltStrProg = extApp(lt("a", "b"));
    expect(ltStrProg.__adj[ltStrProg.__id].kind).toBe("str/lt");
  });

  test("createApp still handles eq", () => {
    const extApp = createApp(...stdPlugins, ordPlugin);
    const extEqProg = extApp(eq(3, 4));
    expect(extEqProg.__adj[extEqProg.__id].kind).toBe("num/eq");
  });
});

// =====================================================================
// 05-predicates: compile-time only — placeholder proving types exist
// =====================================================================
describe("05-predicates (types exist)", () => {
  test("predicate constructors return correct tags", () => {
    expect(byKind("num/add")._tag).toBe("kind");
    expect(byKindGlob("num/")._tag).toBe("kindGlob");
    expect(isLeaf()._tag).toBe("leaf");
    expect(hasChildCount(2)._tag).toBe("count");
    expect(not(isLeaf())._tag).toBe("not");
    expect(and(byKindGlob("num/"), hasChildCount(2))._tag).toBe("and");
    expect(or(byKind("num/add"), byKind("num/mul"))._tag).toBe("or");
    expect(byName("test")._tag).toBe("name");
  });
});
