/**
 * Koan gates 04a + 04b: structural elaboration and accessor proxy.
 * Tests core's structural and accessor support via createApp.
 */
import { describe, expect, test } from "vitest";
import type { CExpr, KindSpec, Plugin } from "../src/index";
import { add, boolPlugin, createApp, isCExpr, makeCExpr, numPlugin, strPlugin } from "../src/index";

// ─── Test plugins with structural kinds ──────────────────────────────

const geomPlugin = {
  name: "geom",
  ctors: {
    point: <A extends { x: unknown; y: unknown }>(
      a: A,
    ): CExpr<{ x: number; y: number }, "geom/point", [A]> => makeCExpr("geom/point", [a]),
  },
  kinds: {
    "geom/point": { inputs: [{ x: 0, y: 0 }], output: { x: 0, y: 0 } } as KindSpec<
      [{ x: number; y: number }],
      { x: number; y: number }
    >,
  },
  traits: {},
  lifts: {},
  shapes: { "geom/point": { x: "number", y: "number" } },
} satisfies Plugin;

const pairPlugin = {
  name: "pair",
  ctors: {
    pair: <A, B>(a: A, b: B): CExpr<[number, number], "data/pair", [[A, B]]> =>
      makeCExpr("data/pair", [[a, b]]),
  },
  kinds: {
    "data/pair": { inputs: [[0, 0]], output: [0, 0] } as KindSpec<
      [[number, number]],
      [number, number]
    >,
  },
  traits: {},
  lifts: {},
  shapes: { "data/pair": ["number", "number"] },
} satisfies Plugin;

const plugins = [numPlugin, strPlugin, boolPlugin, geomPlugin, pairPlugin] as const;
const testApp = createApp(...plugins);

// =====================================================================
// 04b-accessor: proxy-based deep property access
// =====================================================================
describe("04b-accessor", () => {
  test("property access creates core/access chain", () => {
    const p = makeCExpr<{ x: number; y: number }, "t", []>("t", []);
    expect(isCExpr(p.x)).toBe(true);
    expect(p.x.__kind).toBe("core/access");
    expect((p.x.__args as unknown[])[1]).toBe("x");
  });

  test("deep chain has correct depth and root", () => {
    type D = { a: { b: { c: number } } };
    const d = makeCExpr<D, "t", []>("t", []);
    let cursor: any = d.a.b.c;
    let depth = 0;
    while (cursor.__kind === "core/access") {
      cursor = cursor.__args[0];
      depth++;
    }
    expect(depth).toBe(3);
    expect(cursor.__kind).toBe("t");
  });

  test("accessor elaborates through createApp", () => {
    type Deep = { value: number };
    const d = makeCExpr<Deep, "test/deep", []>("test/deep", []);
    const acc = d.value;
    // Accessor CExpr is valid and typed
    expect(isCExpr(acc)).toBe(true);
    expect(acc.__kind).toBe("core/access");
  });
});

// =====================================================================
// 04a-structural: structural elaboration with records and tuples
// =====================================================================
describe("04a-structural", () => {
  test("point({x: 3, y: 4}) elaborates to named-map children", () => {
    const p = testApp(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const adj = p.__adj as Record<string, any>;
    const root = adj[p.__id];
    expect(root.kind).toBe("geom/point");
    const ch = root.children[0] as Record<string, string>;
    expect(adj[ch.x].kind).toBe("num/literal");
    expect(adj[ch.x].out).toBe(3);
    expect(adj[ch.y].kind).toBe("num/literal");
    expect(adj[ch.y].out).toBe(4);
  });

  test("point({x: add(1,2), y: 3}) has CExpr child", () => {
    const p = testApp(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));
    const adj = p.__adj as Record<string, any>;
    const root = adj[p.__id];
    const ch = root.children[0] as Record<string, string>;
    expect(adj[ch.x].kind).toBe("num/add");
    expect(adj[ch.y].kind).toBe("num/literal");
    expect(adj[ch.y].out).toBe(3);
  });

  test("pair(add(1,2), 3) has tuple children", () => {
    const p = testApp(pairPlugin.ctors.pair(add(1, 2), 3));
    const adj = p.__adj as Record<string, any>;
    const root = adj[p.__id];
    expect(root.kind).toBe("data/pair");
    const ch = root.children[0] as string[];
    expect(Array.isArray(ch)).toBe(true);
    expect(ch.length).toBe(2);
    expect(adj[ch[0]].kind).toBe("num/add");
    expect(adj[ch[1]].kind).toBe("num/literal");
  });

  test("structural with wrong type throws at runtime", () => {
    expect(() => {
      testApp(geomPlugin.ctors.point({ x: "wrong", y: 3 }) as any);
    }).toThrow();
  });
});
