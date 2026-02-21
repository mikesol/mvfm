/**
 * Structural DAG operations — tests that DAG primitives (gc, commit,
 * rewireChildren, spliceWhere, wrapByName) correctly handle structural
 * nodes whose children[0] is a Record or Array, not a flat string.
 *
 * These tests exercise the PRODUCTION createApp path, not test helpers.
 */
import { describe, expect, it } from "vitest";
import type { CExpr, KindSpec, Plugin } from "../src/index";
import {
  add,
  boolPluginU,
  commit,
  createApp,
  dirty,
  fold,
  gc,
  makeCExpr,
  mul,
  numPluginU,
  strPluginU,
  sub,
} from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ─── Structural plugins ─────────────────────────────────────────────

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
  nodeKinds: ["geom/point"] as const,
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
  nodeKinds: ["data/pair"] as const,
  shapes: { "data/pair": ["number", "number"] },
} satisfies Plugin;

const appS = createApp(numPluginU, strPluginU, boolPluginU, geomPlugin, pairPlugin);

// ═════════════════════════════════════════════════════════════════════
// GC must preserve structural children
// ═════════════════════════════════════════════════════════════════════

describe("gc preserves structural children", () => {
  it("gc on point({x:3, y:4}) keeps both literal children", () => {
    const prog = appS(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned as any);
    // All nodes should survive GC — root + 2 literals
    const nodeCount = Object.keys(committed.__adj).length;
    expect(nodeCount).toBe(3); // point + x-literal + y-literal
  });

  it("gc on point({x: add(1,2), y: 3}) keeps CExpr subtree", () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned as any);
    // root(point) + add + lit(1) + lit(2) + lit(3) = 5
    const nodeCount = Object.keys(committed.__adj).length;
    expect(nodeCount).toBe(5);
  });

  it("gc on pair(add(1,2), 3) keeps tuple children", () => {
    const prog = appS(pairPlugin.ctors.pair(add(1, 2), 3));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned as any);
    // root(pair) + add + lit(1) + lit(2) + lit(3) = 5
    const nodeCount = Object.keys(committed.__adj).length;
    expect(nodeCount).toBe(5);
  });

  it("gc + fold round-trip: point survives and evaluates", async () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(10, 20), y: mul(3, 4) }));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned as any);
    const { interp } = createTestInterp();
    const result = await fold(committed as any, interp);
    expect(result).toEqual({ x: 30, y: 12 });
  });

  it("gc + fold round-trip: pair survives and evaluates", async () => {
    const prog = appS(pairPlugin.ctors.pair(sub(10, 3), add(1, 1)));
    const d = dirty(prog);
    const cleaned = gc(d);
    const committed = commit(cleaned as any);
    const { interp } = createTestInterp();
    // pair handler needed — add to interp
    interp["data/pair"] = async function* (e) {
      const map = e.children[0] as unknown as string[];
      const a = yield map[0];
      const b = yield map[1];
      return [a, b];
    };
    const result = await fold(committed as any, interp);
    expect(result).toEqual([7, 2]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// commit must validate structural children
// ═════════════════════════════════════════════════════════════════════

describe("commit validates structural children", () => {
  it("commit does NOT throw on a valid structural graph", () => {
    const prog = appS(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const d = dirty(prog);
    // Should not throw — all structural refs are valid
    expect(() => commit(d as any)).not.toThrow();
  });

  it("commit throws when a structural child is removed", () => {
    const prog = appS(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const d = dirty(prog);
    const adj = d.__adj;
    const root = adj[d.__id];
    const childMap = root.children[0] as unknown as Record<string, string>;
    // Remove the x-child node
    const mutated = { ...d, __adj: { ...adj } } as any;
    delete mutated.__adj[childMap.x];
    expect(() => commit(mutated)).toThrow();
  });

  it("commit throws when a pair's tuple child is removed", () => {
    const prog = appS(pairPlugin.ctors.pair(1, 2));
    const d = dirty(prog);
    const adj = d.__adj;
    const root = adj[d.__id];
    const childArr = root.children[0] as unknown as string[];
    const mutated = { ...d, __adj: { ...adj } } as any;
    delete mutated.__adj[childArr[0]];
    expect(() => commit(mutated)).toThrow();
  });
});
