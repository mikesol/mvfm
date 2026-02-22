/**
 * Core API gates (06-10): select, map, replace, gc, dirty.
 */
import { describe, expect, test } from "vitest";
import type { RuntimeEntry } from "../src/index";
import {
  add,
  addEntry,
  and,
  app,
  byKind,
  byKindGlob,
  collectReachable,
  dirty,
  hasChildCount,
  isLeaf,
  liveAdj,
  mapWhere,
  mul,
  not,
  numLit,
  removeEntry,
  replaceWhere,
  rewireChildren,
  selectWhere,
  setRoot,
  swapEntry,
} from "../src/index";

// Shared program: (3+4)*5
// a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// =====================================================================
// 06-select
// =====================================================================
describe("06-select", () => {
  function setEq(actual: Set<string>, expected: string[]) {
    expect(Array.from(actual).sort()).toEqual(expected.slice().sort());
  }

  test("byKind selects matching nodes", () => {
    setEq(selectWhere(prog, byKind("num/add")), ["c"]);
    setEq(selectWhere(prog, byKind("num/mul")), ["e"]);
    setEq(selectWhere(prog, byKind("num/literal")), ["a", "b", "d"]);
  });

  test("isLeaf selects leaf nodes", () => {
    setEq(selectWhere(prog, isLeaf()), ["a", "b", "d"]);
  });

  test("byKindGlob selects by prefix", () => {
    setEq(selectWhere(prog, byKindGlob("num/")), ["a", "b", "c", "d", "e"]);
  });

  test("not(isLeaf) selects branches", () => {
    setEq(selectWhere(prog, not(isLeaf())), ["c", "e"]);
  });

  test("hasChildCount selects by arity", () => {
    setEq(selectWhere(prog, hasChildCount(2)), ["c", "e"]);
    setEq(selectWhere(prog, hasChildCount(0)), ["a", "b", "d"]);
  });

  test("and combinator", () => {
    setEq(selectWhere(prog, and(byKindGlob("num/"), hasChildCount(2))), ["c", "e"]);
  });

  test("empty result", () => {
    setEq(selectWhere(prog, byKind("str/literal")), []);
  });
});

// =====================================================================
// 07-map
// =====================================================================
describe("07-map", () => {
  test("rename add to sub via mapWhere", () => {
    const swapped = mapWhere(prog, byKind("num/add"), (entry) => ({
      kind: "num/sub" as const,
      children: entry.children,
      out: entry.out,
    }));
    expect(swapped.__adj.c.kind).toBe("num/sub");
    expect(swapped.__adj.a.kind).toBe("num/literal");
    expect(swapped.__adj.e.kind).toBe("num/mul");
    expect(swapped.__id).toBe("e");
  });

  test("root mapping changes kind", () => {
    const stringified = mapWhere(prog, byKind("num/mul"), () => ({
      kind: "str/repr" as const,
      children: ["c", "d"] as ["c", "d"],
      out: "" as string,
    }));
    expect(stringified.__adj.e.kind).toBe("str/repr");
    expect(stringified.__adj.a.kind).toBe("num/literal");
  });

  test("compound predicate maps only leaves", () => {
    const leafMapped = mapWhere(prog, and(byKindGlob("num/"), isLeaf()), (entry) => ({
      kind: "num/const" as const,
      children: entry.children,
      out: entry.out,
    }));
    expect(leafMapped.__adj.a.kind).toBe("num/const");
    expect(leafMapped.__adj.b.kind).toBe("num/const");
    expect(leafMapped.__adj.d.kind).toBe("num/const");
    expect(leafMapped.__adj.c.kind).toBe("num/add");
    expect(leafMapped.__adj.e.kind).toBe("num/mul");
  });

  test("no entries lost after map", () => {
    const swapped = mapWhere(prog, byKind("num/add"), (entry) => ({
      kind: "num/sub" as const,
      children: entry.children,
      out: entry.out,
    }));
    expect(Object.keys(swapped.__adj).length).toBe(5);
  });
});

// =====================================================================
// 08-replace
// =====================================================================
describe("08-replace", () => {
  test("replace add to sub", () => {
    const replaced = replaceWhere(prog, byKind("num/add"), "num/sub");
    expect(replaced.__adj.c.kind).toBe("num/sub");
    expect(replaced.__adj.a.kind).toBe("num/literal");
    expect(replaced.__adj.e.kind).toBe("num/mul");
    expect(replaced.__adj.c.children).toEqual(["a", "b"]);
  });

  test("replace root", () => {
    const rootReplaced = replaceWhere(prog, byKind("num/mul"), "str/repr");
    expect(rootReplaced.__adj.e.kind).toBe("str/repr");
    expect(rootReplaced.__adj.a.kind).toBe("num/literal");
  });

  test("replace all leaves", () => {
    const lr = replaceWhere(prog, isLeaf(), "num/const");
    expect(lr.__adj.a.kind).toBe("num/const");
    expect(lr.__adj.b.kind).toBe("num/const");
    expect(lr.__adj.d.kind).toBe("num/const");
    expect(lr.__adj.c.kind).toBe("num/add");
    expect(lr.__adj.e.kind).toBe("num/mul");
  });
});

// =====================================================================
// 09-gc
// =====================================================================
describe("09-gc", () => {
  function setEq(actual: Set<string>, expected: string[]) {
    expect(Array.from(actual).sort()).toEqual(expected.slice().sort());
  }

  test("chain with orphan", () => {
    const chainAdj: Record<string, RuntimeEntry> = {
      a: { kind: "lit", children: [], out: 1 },
      b: { kind: "add", children: ["a"], out: 2 },
      c: { kind: "mul", children: ["b"], out: 3 },
      x: { kind: "orphan", children: [], out: 0 },
    };
    setEq(collectReachable(chainAdj, "c"), ["a", "b", "c"]);
    const live = liveAdj(chainAdj, "c");
    expect("x" in live).toBe(false);
    expect("a" in live && "b" in live && "c" in live).toBe(true);
  });

  test("DAG with shared node", () => {
    const dagAdj: Record<string, RuntimeEntry> = {
      s: { kind: "shared", children: [], out: 0 },
      l: { kind: "left", children: ["s"], out: 0 },
      r: { kind: "right", children: ["s"], out: 0 },
      root: { kind: "top", children: ["l", "r"], out: 0 },
      orphan: { kind: "dead", children: [], out: 0 },
    };
    setEq(collectReachable(dagAdj, "root"), ["root", "l", "r", "s"]);
    const live = liveAdj(dagAdj, "root");
    expect("orphan" in live).toBe(false);
    expect(Object.keys(live).length).toBe(4);
  });

  test("single node", () => {
    const adj: Record<string, RuntimeEntry> = {
      root: { kind: "lit", children: [], out: 42 },
    };
    expect(Array.from(collectReachable(adj, "root"))).toEqual(["root"]);
  });

  test("all reachable (no orphans)", () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "lit", children: [], out: 1 },
      b: { kind: "use", children: ["a"], out: 2 },
    };
    expect(Object.keys(liveAdj(adj, "b")).length).toBe(2);
  });
});

// =====================================================================
// 10-dirty
// =====================================================================
describe("10-dirty", () => {
  test("dirty creates a DirtyExpr with same data", () => {
    const d = dirty(prog);
    expect(d.__id).toBe("e");
    expect(d.__adj.a.kind).toBe("num/literal");
  });

  test("addEntry adds to adj", () => {
    const d = dirty(prog);
    const d2 = addEntry(d, "f", {
      kind: "debug/log",
      children: ["e"],
      out: undefined,
    });
    expect(d2.__adj.f.kind).toBe("debug/log");
    expect(d2.__adj.a.kind).toBe("num/literal");
  });

  test("removeEntry removes from adj", () => {
    const d = dirty(prog);
    const d3 = removeEntry(d, "a");
    expect("a" in d3.__adj).toBe(false);
    expect(d3.__adj.b.kind).toBe("num/literal");
  });

  test("swapEntry replaces entry", () => {
    const d = dirty(prog);
    const d4 = swapEntry(d, "c", {
      kind: "num/sub",
      children: ["a", "b"],
      out: 0,
    });
    expect(d4.__adj.c.kind).toBe("num/sub");
    expect(d4.__adj.a.kind).toBe("num/literal");
  });

  test("rewireChildren replaces child refs globally", () => {
    const d = dirty(prog);
    const d5 = rewireChildren(d, "a", "b");
    expect(d5.__adj.c.children).toEqual(["b", "b"]);
    expect(d5.__adj.e.children).toEqual(["c", "d"]);
  });

  test("setRoot changes root ID", () => {
    const d = dirty(prog);
    const d6 = setRoot(d, "c");
    expect(d6.__id).toBe("c");
  });
});
