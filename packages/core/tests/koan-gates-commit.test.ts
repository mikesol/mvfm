/**
 * Core API gates (11-15): commit, wrap, splice, named, dagql.
 */
import { describe, expect, test } from "vitest";
import {
  add,
  addEntry,
  app,
  byKind,
  byName,
  commit,
  dirty,
  gc,
  gcPreservingAliases,
  isLeaf,
  mapWhere,
  mul,
  name,
  numLit,
  pipe,
  removeEntry,
  replaceWhere,
  selectWhere,
  setRoot,
  spliceWhere,
  swapEntry,
  wrapByName,
} from "../src/index";

// Shared program: (3+4)*5
const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));

// =====================================================================
// 11-commit
// =====================================================================
describe("11-commit", () => {
  test("round-trip: dirty -> commit preserves data", () => {
    const rt = commit(dirty(prog));
    expect(rt.__id).toBe("e");
    expect(rt.__adj.a.kind).toBe("num/literal");
    expect(rt.__adj.e.kind).toBe("num/mul");
    expect(Object.keys(rt.__adj).length).toBe(5);
  });

  test("dirty -> swap -> commit", () => {
    const sw = commit(
      swapEntry(dirty(prog), "c", {
        kind: "num/sub",
        children: ["a", "b"],
        out: 0,
      }),
    );
    expect(sw.__adj.c.kind).toBe("num/sub");
    expect(sw.__adj.a.kind).toBe("num/literal");
  });

  test("dirty -> addEntry -> gc -> commit cleans orphans", () => {
    const withOrphan = addEntry(dirty(prog), "orphan", {
      kind: "dead",
      children: [],
      out: undefined,
    });
    const cleaned = commit(gc(withOrphan));
    expect("orphan" in cleaned.__adj).toBe(false);
    expect(Object.keys(cleaned.__adj).length).toBe(5);
    expect(cleaned.__adj.e.kind).toBe("num/mul");
  });

  test("commit throws on missing root", () => {
    expect(() => commit(setRoot(dirty(prog), "nonexistent"))).toThrow(/root/);
  });

  test("commit throws on dangling children", () => {
    expect(() => commit(removeEntry(dirty(prog), "a"))).toThrow(/missing child/);
  });

  test("commit succeeds after fixing dangling refs", () => {
    const fixed = commit(
      swapEntry(removeEntry(dirty(prog), "a"), "c", {
        kind: "num/add",
        children: ["b", "b"],
        out: undefined,
      }),
    );
    expect(fixed.__adj.c.kind).toBe("num/add");
    expect(fixed.__adj.c.children).toEqual(["b", "b"]);
    expect("a" in fixed.__adj).toBe(false);
  });
});

// =====================================================================
// 12-wrap
// =====================================================================
describe("12-wrap", () => {
  test("wrap non-root node c", () => {
    const w = wrapByName(prog, "c", "telemetry/span");
    expect(w.__adj.f.kind).toBe("telemetry/span");
    expect(w.__adj.f.children).toEqual(["c"]);
    expect(w.__adj.e.children).toEqual(["f", "d"]);
    expect(w.__adj.c.kind).toBe("num/add");
    expect(w.__id).toBe("e");
    expect(w.__counter).toBe("g");
  });

  test("wrap root node e", () => {
    const wr = wrapByName(prog, "e", "debug/root");
    expect(wr.__id).toBe("f");
    expect(wr.__adj.f.children).toEqual(["e"]);
    expect(wr.__adj.f.kind).toBe("debug/root");
  });

  test("wrapper child is NOT self-rewired", () => {
    const w = wrapByName(prog, "c", "telemetry/span");
    expect(w.__adj.f.children[0]).toBe("c");
    const wr = wrapByName(prog, "e", "debug/root");
    expect(wr.__adj.f.children[0]).toBe("e");
  });
});

// =====================================================================
// 13-splice
// =====================================================================
describe("13-splice", () => {
  test("wrap-then-splice round-trips", () => {
    const wrapped = wrapByName(prog, "c", "debug/wrap");
    const rt = spliceWhere(commit(wrapped), byKind("debug/wrap"));
    expect(rt.__adj.c.kind).toBe("num/add");
    expect(rt.__adj.e.children).toEqual(["c", "d"]);
    expect("f" in rt.__adj).toBe(false);
    expect(rt.__id).toBe("e");
    expect(Object.keys(rt.__adj).length).toBe(5);
  });

  test("double-wrap-then-splice recursive reconnection", () => {
    const w1 = wrapByName(prog, "c", "debug/wrap");
    const w2 = wrapByName(w1, "f", "debug/wrap");
    const ds = spliceWhere(commit(w2), byKind("debug/wrap"));
    expect(ds.__adj.e.children).toEqual(["c", "d"]);
    expect("f" in ds.__adj).toBe(false);
    expect("g" in ds.__adj).toBe(false);
    expect(Object.keys(ds.__adj).length).toBe(5);
  });

  test("splice leaves creates dangling refs that fail commit", () => {
    const nl = spliceWhere(prog, isLeaf());
    // Leaves have no children → dangling refs remain in parent
    expect("a" in nl.__adj).toBe(false);
    expect("b" in nl.__adj).toBe(false);
    expect("d" in nl.__adj).toBe(false);
    expect(nl.__id).toBe("e");
    // commit should reject the dangling references
    expect(() => commit(dirty(nl) as any)).toThrow();
  });

  test("splice root makes first child new root", () => {
    const nm = spliceWhere(prog, byKind("num/mul"));
    expect(nm.__id).toBe("c");
    expect("e" in nm.__adj).toBe(false);
    expect(nm.__adj.c.kind).toBe("num/add");
    expect(nm.__adj.a.kind).toBe("num/literal");
    expect(Object.keys(nm.__adj).length).toBe(4);
  });
});

// =====================================================================
// 14-named
// =====================================================================
describe("14-named", () => {
  const named = name(prog, "the-sum", "c");

  test("name adds @alias entry", () => {
    expect(named.__adj["@the-sum"].kind).toBe("@alias");
    expect(named.__adj["@the-sum"].children[0]).toBe("c");
    expect(named.__adj.c.kind).toBe("num/add");
    expect(named.__counter).toBe("f");
  });

  test("selectWhere + byName finds target", () => {
    const sel = selectWhere(named, byName("the-sum"));
    expect(sel.has("c" as any)).toBe(true);
    expect(sel.size).toBe(1);
    expect(sel.has("@the-sum" as any)).toBe(false);
  });

  test("replaceWhere + byName transforms target", () => {
    const rep = replaceWhere(named, byName("the-sum"), "num/sub");
    expect(rep.__adj.c.kind).toBe("num/sub");
    expect(rep.__adj.a.kind).toBe("num/literal");
    expect(rep.__adj.e.kind).toBe("num/mul");
  });

  test("standard gc removes alias", () => {
    const cleaned = commit(gc(dirty(named)));
    expect("@the-sum" in cleaned.__adj).toBe(false);
    expect("c" in cleaned.__adj).toBe(true);
    expect(Object.keys(cleaned.__adj).length).toBe(5);
  });

  test("gcPreservingAliases keeps alias alive", () => {
    const preserved = commit(gcPreservingAliases(dirty(named)));
    expect("@the-sum" in preserved.__adj).toBe(true);
    expect("c" in preserved.__adj).toBe(true);
    expect(Object.keys(preserved.__adj).length).toBe(6);
  });
});

// =====================================================================
// 15-dagql (pipe)
// =====================================================================
describe("15-dagql", () => {
  test("single replaceWhere via pipe", () => {
    const jr = pipe(prog, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(jr.__adj.c.kind).toBe("num/sub");
    expect(jr.__adj.a.kind).toBe("num/literal");
  });

  test("chained replace + splice via pipe", () => {
    // Replace add→sub, then splice sub: sub(a,b) → picks child[0] = a
    const ch = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => spliceWhere(commit(e), byKind("num/sub")),
    );
    expect("c" in ch.__adj).toBe(false);
    expect(ch.__adj.e.kind).toBe("num/mul");
    expect(ch.__adj.e.children).toEqual(["a", "d"]);
    expect(ch.__id).toBe("e");
  });

  test("triple chain: replace, map, splice", () => {
    const tc = pipe(
      prog,
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) =>
        mapWhere(e, byKind("num/mul"), (entry) => ({
          kind: "num/product" as const,
          children: entry.children,
          out: entry.out,
        })),
      (e) => spliceWhere(commit(e), isLeaf()),
    );
    expect(tc.__adj.c.kind).toBe("num/sub");
    expect(tc.__adj.e.kind).toBe("num/product");
    expect("a" in tc.__adj).toBe(false);
    expect(Object.keys(tc.__adj).length).toBe(2);
  });
});
