import { describe, expect, test } from "vitest";
import {
  add,
  and,
  app,
  byKind,
  byKindGlob,
  commit,
  defaults,
  fold,
  hasChildCount,
  isLeaf,
  mapWhere,
  mul,
  not,
  numLit,
  or,
  replaceWhere,
  selectWhere,
  stdPlugins,
} from "../../src/index";

// (3+4)*5 -> a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const p = () => app(mul(add(numLit(3), numLit(4)), numLit(5)));

describe("Predicates & Select", () => {
  test("byKind finds add", () => {
    const s = selectWhere(p(), byKind("num/add"));
    expect(s.size).toBe(1);
    expect(s.has("c" as any)).toBe(true);
  });
  test("byKindGlob finds all num", () => {
    expect(selectWhere(p(), byKindGlob("num/")).size).toBe(5);
  });
  test("isLeaf finds literals", () => {
    const s = selectWhere(p(), isLeaf());
    expect(s.size).toBe(3);
    for (const id of ["a", "b", "d"]) expect(s.has(id as any)).toBe(true);
  });
  test("hasChildCount(2) finds binary ops", () => {
    const s = selectWhere(p(), hasChildCount(2));
    expect(s.size).toBe(2);
    for (const id of ["c", "e"]) expect(s.has(id as any)).toBe(true);
  });
  test("not(isLeaf) finds non-leaves", () => {
    const s = selectWhere(p(), not(isLeaf()));
    expect(s.size).toBe(2);
  });
  test("and compound", () => {
    expect(selectWhere(p(), and(byKindGlob("num/"), hasChildCount(2))).size).toBe(2);
  });
  test("or union", () => {
    expect(selectWhere(p(), or(byKind("num/add"), byKind("num/mul"))).size).toBe(2);
  });
  test("nonexistent kind -> empty", () => {
    expect(selectWhere(p(), byKind("nonexistent")).size).toBe(0);
  });
  test("single literal isLeaf", () => {
    expect(selectWhere(app(numLit(42)), isLeaf()).size).toBe(1);
  });
  test("hasChildCount(0) same as isLeaf", () => {
    expect(selectWhere(p(), hasChildCount(0)).size).toBe(selectWhere(p(), isLeaf()).size);
  });
});

describe("Map & Replace", () => {
  test("mapWhere renames kind", () => {
    const m = mapWhere(p(), byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      out: e.out,
    }));
    expect(m.__adj.c.kind).toBe("num/sub");
  });
  test("replaceWhere changes kind", () => {
    expect(replaceWhere(p(), byKind("num/add"), "num/sub").__adj.c.kind).toBe("num/sub");
  });
  test("unmatched preserved", () => {
    const r = replaceWhere(p(), byKind("num/add"), "num/sub");
    expect(r.__adj.a.kind).toBe("num/literal");
    expect(r.__adj.e.kind).toBe("num/mul");
  });
  test("replaceWhere on root", () => {
    const r = replaceWhere(p(), byKind("num/mul"), "num/sub");
    expect(r.__adj.e.kind).toBe("num/sub");
  });
  test("map preserves children and out", () => {
    const pr = p();
    const m = mapWhere(pr, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      out: e.out,
    }));
    expect(m.__adj.c.children).toEqual(["a", "b"]);
    expect(m.__adj.c.out).toBe(pr.__adj.c.out);
  });
  test("replaceWhere + fold = correct", async () => {
    const r = replaceWhere(p(), byKind("num/add"), "num/sub");
    expect(await fold(commit(r), defaults(stdPlugins))).toBe(-5);
  });
  test("replaceWhere all leaves", () => {
    const r = replaceWhere(p(), isLeaf(), "num/zero");
    for (const id of ["a", "b", "d"]) expect(r.__adj[id].kind).toBe("num/zero");
  });
  test("mapWhere compound pred", () => {
    const m = mapWhere(p(), and(byKindGlob("num/"), isLeaf()), (e) => ({
      kind: "mapped/lit" as const,
      children: e.children,
      out: e.out,
    }));
    expect(m.__adj.a.kind).toBe("mapped/lit");
    expect(m.__adj.c.kind).toBe("num/add");
  });
});
