import { describe, expect, test } from "vitest";
import { add, fold, type Interpreter, type RuntimeEntry } from "../../src/index";
import {
  accessorApp,
  adjOf,
  deepThing,
  line,
  makeCExprProxy,
  pair,
  point,
  rootOf,
  structuralApp,
} from "./_structural-helpers";

// =====================================================================
describe("structural elaboration (04a pattern)", () => {
  test("point({x:3, y:4}) produces named record children", () => {
    const p = structuralApp(point({ x: 3, y: 4 }));
    const r = rootOf(p);
    expect(r.kind).toBe("geom/point");
    const ch = (r.children as [Record<string, string>])[0];
    expect(adjOf(p)[ch.x].kind).toBe("num/literal");
    expect(adjOf(p)[ch.x].out).toBe(3);
    expect(adjOf(p)[ch.y].kind).toBe("num/literal");
    expect(adjOf(p)[ch.y].out).toBe(4);
  });

  test("point({x: add(1,2), y: 3}) x -> num/add", () => {
    const p = structuralApp(point({ x: add(1, 2), y: 3 }));
    const ch = (rootOf(p).children as [Record<string, string>])[0];
    expect(adjOf(p)[ch.x].kind).toBe("num/add");
    expect(adjOf(p)[ch.y].kind).toBe("num/literal");
    expect(adjOf(p)[ch.y].out).toBe(3);
  });

  test("line with nested records", () => {
    const p = structuralApp(line({ start: { x: 1, y: 2 }, end: { x: add(3, 4), y: 5 } }));
    expect(rootOf(p).kind).toBe("geom/line");
    const ch = (rootOf(p).children as [Record<string, Record<string, string>>])[0];
    expect(adjOf(p)[ch.end.x].kind).toBe("num/add");
    expect(adjOf(p)[ch.start.x].kind).toBe("num/literal");
    expect(adjOf(p)[ch.start.x].out).toBe(1);
    expect(adjOf(p)[ch.start.y].out).toBe(2);
  });

  test("pair (tuple) produces positional children", () => {
    const p = structuralApp(pair(add(1, 2), 3));
    expect(rootOf(p).kind).toBe("data/pair");
    const ch = (rootOf(p).children as [string[]])[0];
    expect(Array.isArray(ch)).toBe(true);
    expect(ch.length).toBe(2);
  });

  test("line node count is 7", () => {
    const p = structuralApp(line({ start: { x: 1, y: 2 }, end: { x: add(3, 4), y: 5 } }));
    expect(Object.keys(adjOf(p)).length).toBe(7);
  });

  test("named map children are order-independent", () => {
    const p1 = structuralApp(point({ x: 10, y: 20 }));
    const p2 = structuralApp(point({ y: 20, x: 10 }));
    const ch1 = (rootOf(p1).children as [Record<string, string>])[0];
    const ch2 = (rootOf(p2).children as [Record<string, string>])[0];
    expect(adjOf(p1)[ch1.x].out).toBe(10);
    expect(adjOf(p1)[ch1.y].out).toBe(20);
    expect(adjOf(p2)[ch2.x].out).toBe(10);
    expect(adjOf(p2)[ch2.y].out).toBe(20);
  });

  test("point({x:'wrong'}) throws at runtime", () => {
    expect(() => structuralApp(point({ x: "wrong", y: 3 }) as any)).toThrow();
  });
});

// =====================================================================
describe("accessor (04b pattern)", () => {
  test("makeCExprProxy creates proxy with correct __kind", () => {
    const p = makeCExprProxy("test/kind", [1, 2]);
    expect(p.__kind).toBe("test/kind");
    expect(p.__args).toEqual([1, 2]);
  });

  test("property access creates core/access CExpr", () => {
    const a = makeCExprProxy("test/deep", []);
    expect(a.foo.__kind).toBe("core/access");
    expect(a.foo.__args[1]).toBe("foo");
  });

  test("chained access creates nested core/access", () => {
    const a = makeCExprProxy("test/deep", []);
    const chained = a.x.y;
    expect(chained.__kind).toBe("core/access");
    expect(chained.__args[1]).toBe("y");
    expect(chained.__args[0].__kind).toBe("core/access");
    expect(chained.__args[0].__args[1]).toBe("x");
  });

  test("array index access creates core/access", () => {
    const a = makeCExprProxy("test/deep", []);
    expect(a[0].__kind).toBe("core/access");
    expect(a[0].__args[1]).toBe("0");
  });

  test("deep accessor: 7 levels like koan", () => {
    const a = deepThing();
    const evil = a.helloRecord.boy[3].am.i[0].mean;
    let cursor: any = evil;
    let depth = 0;
    while (cursor.__kind === "core/access") {
      cursor = cursor.__args[0];
      depth++;
    }
    expect(depth).toBe(7);
    expect(cursor.__kind).toBe("test/deep");
  });

  test("accessorApp builds accessor chain into graph", () => {
    const a = deepThing();
    const evil = a.helloRecord.boy[3].am.i[0].mean;
    const pt = makeCExprProxy("geom/point", [evil, makeCExprProxy("num/add", [1, 2])]);
    const p = accessorApp(pt);
    const kinds = Object.values(p.__adj).map((e) => e.kind);
    expect(kinds).toContain("geom/point");
    expect(kinds).toContain("num/add");
    expect(kinds).toContain("core/access");
    expect(kinds).toContain("test/deep");
    expect(kinds.filter((k) => k === "core/access").length).toBe(7);
    expect(Object.keys(p.__adj).length).toBe(12);
  });
});

// =====================================================================
describe("structural fold via manual adj (fold from 16)", () => {
  const numInterp: Interpreter = {
    "num/literal": async function* (e) {
      return e.out as number;
    },
    "num/add": async function* () {
      return ((yield 0) as number) + ((yield 1) as number);
    },
    "num/mul": async function* () {
      return ((yield 0) as number) * ((yield 1) as number);
    },
  };
  const pointH: Interpreter["string"] = async function* (entry) {
    const m = entry.out as Record<string, string>;
    return { x: (yield m.x) as number, y: (yield m.y) as number };
  };

  test("geom/point yields string IDs for {x, y}", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 10 },
      b: { kind: "num/literal", children: [], out: 20 },
      c: { kind: "geom/point", children: [], out: { x: "a", y: "b" } },
    };
    const r = await fold<{ x: number; y: number }>("c", adj, {
      ...numInterp,
      "geom/point": pointH,
    });
    expect(r).toEqual({ x: 10, y: 20 });
  });

  test("nested structural: point containing add nodes", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "num/literal", children: [], out: 2 },
      c: { kind: "num/add", children: ["a", "b"], out: undefined },
      d: { kind: "num/literal", children: [], out: 3 },
      e: { kind: "geom/point", children: [], out: { x: "c", y: "d" } },
    };
    const r = await fold<{ x: number; y: number }>("e", adj, {
      ...numInterp,
      "geom/point": pointH,
    });
    expect(r).toEqual({ x: 3, y: 3 });
  });

  test("tuple-like handler yields string IDs", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 5 },
      b: { kind: "num/literal", children: [], out: 7 },
      c: { kind: "data/pair", children: [], out: ["a", "b"] },
    };
    const interp: Interpreter = {
      ...numInterp,
      "data/pair": async function* (entry) {
        const refs = entry.out as string[];
        return [(yield refs[0]) as number, (yield refs[1]) as number];
      },
    };
    expect(await fold<[number, number]>("c", adj, interp)).toEqual([5, 7]);
  });

  test("mixed: structural containing arithmetic", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 2 },
      b: { kind: "num/literal", children: [], out: 3 },
      c: { kind: "num/mul", children: ["a", "b"], out: undefined },
      d: { kind: "num/literal", children: [], out: 10 },
      e: { kind: "num/add", children: ["c", "d"], out: undefined },
      f: { kind: "num/literal", children: [], out: 100 },
      g: { kind: "geom/point", children: [], out: { x: "e", y: "f" } },
    };
    const r = await fold<{ x: number; y: number }>("g", adj, {
      ...numInterp,
      "geom/point": pointH,
    });
    expect(r).toEqual({ x: 16, y: 100 });
  });

  test("structural fold: memoization with shared node", async () => {
    let litEvals = 0;
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 42 },
      b: { kind: "geom/point", children: [], out: { x: "a", y: "a" } },
    };
    const interp: Interpreter = {
      "num/literal": async function* (e) {
        litEvals++;
        return e.out as number;
      },
      "geom/point": pointH,
    };
    const r = await fold<{ x: number; y: number }>("b", adj, interp);
    expect(r).toEqual({ x: 42, y: 42 });
    expect(litEvals).toBe(1);
  });

  test("point with all literal children", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 0 },
      b: { kind: "num/literal", children: [], out: 0 },
      c: { kind: "geom/point", children: [], out: { x: "a", y: "b" } },
    };
    const r = await fold<{ x: number; y: number }>("c", adj, {
      ...numInterp,
      "geom/point": pointH,
    });
    expect(r).toEqual({ x: 0, y: 0 });
  });

  test("point missing handler throws", async () => {
    const adj: Record<string, RuntimeEntry> = {
      a: { kind: "num/literal", children: [], out: 1 },
      b: { kind: "geom/point", children: [], out: { x: "a", y: "a" } },
    };
    await expect(fold("b", adj, numInterp)).rejects.toThrow("no handler");
  });
});
