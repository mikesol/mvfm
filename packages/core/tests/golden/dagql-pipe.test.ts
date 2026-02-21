import { describe, expect, test } from "vitest";
import {
  type AdjOf,
  add,
  app,
  byKind,
  commit,
  defaults,
  fold,
  type IdOf,
  mapWhere,
  mul,
  numLit,
  type OutOf,
  pipe,
  replaceWhere,
  selectWhere,
  spliceWhere,
  stdPlugins,
  wrapByName,
} from "../../src/index";

// (3+4)*5 → a=lit3, b=lit4, c=add, d=lit5, e=mul, counter=f
const p = () => app(mul(add(numLit(3), numLit(4)), numLit(5)));
const interp = () => defaults(stdPlugins);

// ── Single operation ─────────────────────────────────────────────────

describe("Single operation", () => {
  test("pipe with replaceWhere", () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(r.__adj.c.kind).toBe("num/sub");
    expect(r.__adj.a.kind).toBe("num/literal");
  });

  test("pipe with single mapWhere", () => {
    const m = pipe(p(), (e) =>
      mapWhere(e, byKind("num/mul"), (entry) => ({
        kind: "num/product" as const,
        children: entry.children,
        out: entry.out,
      })),
    );
    expect(m.__adj.e.kind).toBe("num/product");
    expect(m.__adj.c.kind).toBe("num/add");
  });

  test("pipe with spliceWhere on single-child node", () => {
    // Splice add: add(a,b) → picks child[0] = a
    const s = pipe(p(), (e) => spliceWhere(e, byKind("num/add")));
    expect("c" in s.__adj).toBe(false);
    expect(s.__adj.e.children).toEqual(["a", "d"]);
  });

  test("pipe with wrapByName", () => {
    const w = pipe(p(), (e) => wrapByName(e, "c", "debug/span"));
    expect(w.__adj.f.kind).toBe("debug/span");
    expect(w.__adj.f.children).toEqual(["c"]);
    expect(w.__adj.e.children).toContain("f");
  });
});

// ── Chained operations ───────────────────────────────────────────────

describe("Chained operations", () => {
  test("replace then splice single-child", () => {
    // Replace add→sub, then splice sub: sub(a,b) → picks child[0] = a
    const r = pipe(
      p(),
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => spliceWhere(commit(e), byKind("num/sub")),
    );
    expect("c" in r.__adj).toBe(false);
    expect(r.__adj.e.children).toEqual(["a", "d"]);
  });

  test("replace then fold", async () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(r), interp())).toBe(-5);
  });

  test("three-step: replace, wrap, fold", async () => {
    const r = pipe(
      p(),
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => wrapByName(e, "c", "num/sub"),
    );
    // f wraps c: f(sub) → c(sub) → [a,b]
    expect(r.__adj.f.kind).toBe("num/sub");
    expect(r.__adj.f.children).toEqual(["c"]);
    expect(r.__adj.c.kind).toBe("num/sub");
  });

  test("wrapByName then spliceWhere round-trip restores shape", () => {
    const orig = p();
    const rt = pipe(
      orig,
      (e) => wrapByName(e, "c", "debug/wrap"),
      (e) => spliceWhere(commit(e), byKind("debug/wrap")),
    );
    // After wrap+splice, c should be reconnected to e
    expect(rt.__adj.e.children).toEqual(["c", "d"]);
    expect("f" in rt.__adj).toBe(false);
    expect(rt.__adj.c.kind).toBe("num/add");
  });

  test("replace two kinds in chain", () => {
    const r = pipe(
      p(),
      (e) => replaceWhere(e, byKind("num/add"), "num/sub"),
      (e) => replaceWhere(e, byKind("num/mul"), "num/add"),
    );
    expect(r.__adj.c.kind).toBe("num/sub");
    expect(r.__adj.e.kind).toBe("num/add");
  });

  test("map then splice single-child", () => {
    // Map add→sub, then splice sub: sub(a,b) → picks child[0] = a
    const r = pipe(
      p(),
      (e) =>
        mapWhere(e, byKind("num/add"), (entry) => ({
          kind: "num/sub" as const,
          children: entry.children,
          out: entry.out,
        })),
      (e) => spliceWhere(commit(e), byKind("num/sub")),
    );
    expect("c" in r.__adj).toBe(false);
    expect(r.__adj.e.children).toEqual(["a", "d"]);
  });
});

// ── Type flow ────────────────────────────────────────────────────────

describe("Type flow", () => {
  test("OutOf tracks through pipe", () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    type Out = OutOf<typeof r>;
    // Output is still number — kind change doesn't change output type
    const _check: Out = 42;
    expect(_check).toBe(42);
  });

  test("AdjOf updates through pipe", () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    type Adj = AdjOf<typeof r>;
    // c should now be num/sub
    type CKind = Adj["c"]["kind"];
    const _ck: CKind = "num/sub";
    expect(_ck).toBe("num/sub");
  });

  test("IdOf preserved through non-root transform", () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    type Id = IdOf<typeof r>;
    const _id: Id = "e";
    expect(r.__id).toBe("e");
  });
});

// ── Integration with fold ────────────────────────────────────────────

describe("Integration with fold", () => {
  test("pipe replace add->sub then fold", async () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    // (3-4)*5 = -5
    expect(await fold(commit(r), interp())).toBe(-5);
  });

  test("pipe replace add->mul then fold", async () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/mul"));
    // (3*4)*5 = 60
    expect(await fold(commit(r), interp())).toBe(60);
  });

  test("multiple transforms then fold", async () => {
    // (1+2)*(3+4) → replace add→sub → (1-2)*(3-4) = (-1)*(-1) = 1
    const prog2 = app(mul(add(numLit(1), numLit(2)), add(numLit(3), numLit(4))));
    const r = pipe(prog2, (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    expect(await fold(commit(r), interp())).toBe(1);
  });

  test("replace mul->add then fold", async () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    // add(add(3,4), 5) = (3+4)+5 = 12
    expect(await fold(commit(r), interp())).toBe(12);
  });

  test("app -> pipe -> fold full chain", async () => {
    const result = await fold(
      commit(
        pipe(app(mul(add(numLit(10), numLit(20)), numLit(3))), (e) =>
          replaceWhere(e, byKind("num/add"), "num/sub"),
        ),
      ),
      interp(),
    );
    // (10-20)*3 = -30
    expect(result).toBe(-30);
  });
});

// ── Composition ──────────────────────────────────────────────────────

describe("Composition", () => {
  test("pipe result can be piped again", () => {
    const step1 = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    const step2 = pipe(commit(step1), (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    expect(step2.__adj.c.kind).toBe("num/sub");
    expect(step2.__adj.e.kind).toBe("num/add");
  });

  test("pipe result piped again folds correctly", async () => {
    const step1 = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    const step2 = pipe(commit(step1), (e) => replaceWhere(e, byKind("num/mul"), "num/add"));
    // add(sub(3,4), 5) = (3-4)+5 = 4
    expect(await fold(commit(step2), interp())).toBe(4);
  });

  test("pipe with identity returns equivalent expr", async () => {
    const orig = p();
    const same = pipe(orig, (e) => e);
    expect(same.__id).toBe(orig.__id);
    expect(same.__adj.e.kind).toBe("num/mul");
    expect(await fold(same, interp())).toBe(35);
  });

  test("pipe with no-op function preserves structure", () => {
    const orig = p();
    const noop = pipe(orig, (e) => {
      // return input unchanged
      return e;
    });
    expect(Object.keys(noop.__adj).length).toBe(Object.keys(orig.__adj).length);
    expect(noop.__adj.c.kind).toBe(orig.__adj.c.kind);
    expect(noop.__adj.c.children).toEqual(orig.__adj.c.children);
  });

  test("selectWhere works on pipe result", () => {
    const r = pipe(p(), (e) => replaceWhere(e, byKind("num/add"), "num/sub"));
    const subs = selectWhere(commit(r), byKind("num/sub"));
    expect(subs.size).toBe(1);
    const adds = selectWhere(commit(r), byKind("num/add"));
    expect(adds.size).toBe(0);
  });
});
