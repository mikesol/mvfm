import { describe, expect, test } from "vitest";
import {
  add,
  addEntry,
  and,
  app,
  byKind,
  byKindGlob,
  byName,
  commit,
  defaults,
  dirty,
  fold,
  gc,
  gcPreservingAliases,
  hasChildCount,
  isLeaf,
  mapWhere,
  mul,
  name,
  not,
  numLit,
  or,
  type RuntimeEntry,
  removeEntry,
  replaceWhere,
  rewireChildren,
  selectWhere,
  setRoot,
  spliceWhere,
  stdPlugins,
  swapEntry,
  wrapByName,
} from "../../src/index";

// (3+4)*5 → a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
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
  test("nonexistent kind → empty", () => {
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

describe("GC", () => {
  test("all reachable preserved", () => {
    expect(Object.keys(gc(dirty(p())).__adj).length).toBe(5);
  });
  test("unreachable removed", () => {
    const d = addEntry(dirty(p()), "orphan", {
      kind: "dead" as const,
      children: [] as const,
      out: undefined,
    });
    expect("orphan" in gc(d).__adj).toBe(false);
  });
  test("diamond preserves shared", () => {
    const adj: Record<string, RuntimeEntry> = {
      s: { kind: "num/literal", children: [], out: 1 },
      a: { kind: "num/add", children: ["s", "s"], out: undefined },
      b: { kind: "num/add", children: ["s", "s"], out: undefined },
      r: { kind: "num/mul", children: ["a", "b"], out: undefined },
    };
    const g = gc({ __id: "r", __adj: { ...adj }, __counter: "z" } as any);
    expect(Object.keys(g.__adj).length).toBe(4);
  });
  test("single node gc", () => {
    expect(Object.keys(gc(dirty(app(numLit(42)))).__adj).length).toBe(1);
  });
  test("deeply unreachable removed", () => {
    const d = addEntry(
      addEntry(dirty(p()), "x", {
        kind: "dead" as const,
        children: ["y"] as const,
        out: undefined,
      }),
      "y",
      { kind: "dead" as const, children: [] as const, out: undefined },
    );
    const g = gc(d);
    expect("x" in g.__adj).toBe(false);
    expect("y" in g.__adj).toBe(false);
  });
});

describe("Dirty/Commit", () => {
  test("round-trip preserves", () => {
    const pr = p();
    const c = commit(dirty(pr));
    expect(c.__id).toBe(pr.__id);
    expect(Object.keys(c.__adj).length).toBe(5);
    expect(c.__adj.e.kind).toBe("num/mul");
  });
  test("addEntry", () => {
    const d = addEntry(dirty(p()), "f", {
      kind: "debug/log" as const,
      children: ["e"] as const,
      out: undefined,
    });
    expect(d.__adj.f.kind).toBe("debug/log");
  });
  test("removeEntry", () => {
    expect("a" in removeEntry(dirty(p()), "a").__adj).toBe(false);
  });
  test("swapEntry", () => {
    const d = swapEntry(dirty(p()), "c", {
      kind: "num/sub" as const,
      children: ["a", "b"] as const,
      out: 0,
    });
    expect(d.__adj.c.kind).toBe("num/sub");
  });
  test("rewireChildren", () => {
    expect(rewireChildren(dirty(p()), "a", "b").__adj.c.children).toEqual(["b", "b"]);
  });
  test("setRoot", () => {
    expect(setRoot(dirty(p()), "c").__id).toBe("c");
  });
  test("commit throws on dangling child", () => {
    expect(() => commit(removeEntry(dirty(p()), "a"))).toThrow(/missing child/);
  });
  test("commit throws on missing root", () => {
    expect(() => commit(setRoot(dirty(p()), "nonexistent"))).toThrow(/root/);
  });
  test("swap→commit preserves other entries", () => {
    const c = commit(
      swapEntry(dirty(p()), "c", {
        kind: "num/sub" as const,
        children: ["a", "b"] as const,
        out: 0,
      }),
    );
    expect(c.__adj.a.kind).toBe("num/literal");
    expect(c.__adj.c.kind).toBe("num/sub");
  });
});

describe("Wrap", () => {
  test("non-root: wrapper inserted, parents rewired", () => {
    const w = wrapByName(p(), "c", "debug/wrap");
    expect(w.__adj.f.kind).toBe("debug/wrap");
    expect(w.__adj.e.children).toContain("f");
    expect(w.__adj.e.children).not.toContain("c");
  });
  test("root: root changes to wrapper", () => {
    const w = wrapByName(p(), "e", "debug/root");
    expect(w.__id).toBe("f");
    expect(w.__adj.f.kind).toBe("debug/root");
  });
  test("wrapper children = [target]", () => {
    expect(wrapByName(p(), "c", "debug/wrap").__adj.f.children).toEqual(["c"]);
  });
  test("counter advances", () => {
    expect(p().__counter).toBe("f");
    expect(wrapByName(p(), "c", "debug/wrap").__counter).toBe("g");
  });
  test("target preserved", () => {
    const w = wrapByName(p(), "c", "debug/wrap");
    expect(w.__adj.c.kind).toBe("num/add");
    expect(w.__adj.c.children).toEqual(["a", "b"]);
  });
});

describe("Splice", () => {
  test("removes matched, picks first child as replacement", () => {
    const s = spliceWhere(p(), byKind("num/add"));
    expect("c" in s.__adj).toBe(false);
    // add(a,b) spliced → picks child[0] = a
    expect(s.__adj.e.children).toEqual(["a", "d"]);
  });
  test("wrap-then-splice round-trip", () => {
    const rt = spliceWhere(commit(wrapByName(p(), "c", "debug/wrap")), byKind("debug/wrap"));
    expect(rt.__adj.e.children).toEqual(["c", "d"]);
    expect("f" in rt.__adj).toBe(false);
  });
  test("splice leaf: dangling refs fail commit", () => {
    const s = spliceWhere(p(), isLeaf());
    // Leaves have no children to pick, so parent keeps dangling refs
    // The graph is invalid until rewired — commit should catch it
    expect(() => commit(dirty(s) as any)).toThrow();
  });
  test("splice root: first child becomes root", () => {
    const s = spliceWhere(p(), byKind("num/mul"));
    expect(s.__id).toBe("c");
    expect("e" in s.__adj).toBe(false);
  });
  test("double-wrap then splice", () => {
    const w2 = wrapByName(wrapByName(p(), "c", "debug/wrap"), "f", "debug/wrap");
    expect(spliceWhere(commit(w2), byKind("debug/wrap")).__adj.e.children).toEqual(["c", "d"]);
  });
});

describe("Named", () => {
  test("name adds @alias", () => {
    const n = name(p(), "the-sum", "c");
    expect(n.__adj["@the-sum"].kind).toBe("@alias");
    expect(n.__adj["@the-sum"].children[0]).toBe("c");
  });
  test("selectWhere + byName", () => {
    const s = selectWhere(name(p(), "the-sum", "c"), byName("the-sum"));
    expect(s.size).toBe(1);
    expect(s.has("c" as any)).toBe(true);
  });
  test("gc removes aliases", () => {
    const c = commit(gc(dirty(name(p(), "the-sum", "c"))));
    expect("@the-sum" in c.__adj).toBe(false);
    expect("c" in c.__adj).toBe(true);
  });
  test("gcPreservingAliases keeps aliases", () => {
    const c = commit(gcPreservingAliases(dirty(name(p(), "the-sum", "c"))));
    expect("@the-sum" in c.__adj).toBe(true);
  });
  test("replaceWhere + byName transforms target", () => {
    const r = replaceWhere(name(p(), "the-sum", "c"), byName("the-sum"), "num/sub");
    expect(r.__adj.c.kind).toBe("num/sub");
    expect(r.__adj.a.kind).toBe("num/literal");
  });
});

describe("Fold integration", () => {
  test("(3+4)*5 = 35", async () => {
    expect(await fold(p(), defaults(stdPlugins))).toBe(35);
  });
  test("add→sub: (3-4)*5 = -5", async () => {
    expect(
      await fold(commit(replaceWhere(p(), byKind("num/add"), "num/sub")), defaults(stdPlugins)),
    ).toBe(-5);
  });
  test("add→mul: (3*4)*5 = 60", async () => {
    expect(
      await fold(commit(replaceWhere(p(), byKind("num/add"), "num/mul")), defaults(stdPlugins)),
    ).toBe(60);
  });
});
