/**
 * Structural DAG rewiring — tests that rewireChildren, replaceWhere,
 * and the dirty→mutate→commit→fold pipeline work correctly when the
 * graph contains structural nodes with Record/Array children.
 */
import { describe, expect, it } from "vitest";
import type { CExpr, KindSpec, Plugin } from "../src/index";
import {
  add,
  boolPluginU,
  byKind,
  commit,
  createApp,
  dirty,
  fold,
  gc,
  makeCExpr,
  mul,
  numPluginU,
  pipe,
  replaceWhere,
  rewireChildren,
  selectWhere,
  strPluginU,
} from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ─── Structural plugins (same as structural-dag-ops) ────────────────

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

const appS = createApp(numPluginU, strPluginU, boolPluginU, geomPlugin);

// ═════════════════════════════════════════════════════════════════════
// rewireChildren must update structural Record refs
// ═════════════════════════════════════════════════════════════════════

describe("rewireChildren with structural nodes", () => {
  it("rewiring a structural child updates the Record map", () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));
    const d = dirty(prog);
    const root = d.__adj[d.__id];
    const childMap = root.children[0] as unknown as Record<string, string>;
    const oldXId = childMap.x;

    // Create a replacement node for x
    const newXId = "__replacement_x";
    const mutated = {
      ...d,
      __adj: {
        ...d.__adj,
        [newXId]: { kind: "num/literal", children: [], out: 99 },
      },
    } as any;

    const rewired = rewireChildren(mutated, oldXId, newXId);
    const rewiredRoot = rewired.__adj[rewired.__id];
    const rewiredMap = rewiredRoot.children[0] as unknown as Record<string, string>;

    // The x entry in the structural map should now point to the new node
    expect(rewiredMap.x).toBe(newXId);
    // The y entry should be unchanged
    expect(rewiredMap.y).toBe(childMap.y);
  });

  it("rewired structural graph folds to new value", async () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));
    const d = dirty(prog);
    const root = d.__adj[d.__id];
    const childMap = root.children[0] as unknown as Record<string, string>;
    const oldXId = childMap.x;

    const newXId = "__replacement_x";
    const mutated = {
      ...d,
      __adj: {
        ...d.__adj,
        [newXId]: { kind: "num/literal", children: [], out: 99 },
      },
    } as any;

    const rewired = rewireChildren(mutated, oldXId, newXId);
    const committed = commit(gc(rewired) as any);
    const { interp } = createTestInterp();
    const result = await fold(committed as any, interp);
    expect(result).toEqual({ x: 99, y: 3 });
  });
});

// ═════════════════════════════════════════════════════════════════════
// replaceWhere inside structural subtrees
// ═════════════════════════════════════════════════════════════════════

describe("replaceWhere inside structural subtrees", () => {
  it("replace mul→add inside point's structural children", async () => {
    const prog = appS(geomPlugin.ctors.point({ x: mul(2, 3), y: mul(4, 5) }));

    // Replace all mul with add
    const replaced = commit(replaceWhere(prog, byKind("num/mul"), "num/add"));

    // Verify the kind was changed
    const muls = selectWhere(replaced, byKind("num/mul"));
    expect(muls.size).toBe(0);
    const adds = selectWhere(replaced, byKind("num/add"));
    expect(adds.size).toBe(2);

    // Fold should produce addition results, not multiplication
    const { interp } = createTestInterp();
    const result = await fold(replaced as any, interp);
    expect(result).toEqual({ x: 5, y: 9 }); // 2+3, 4+5 instead of 6, 20
  });

  it("full dirty→replace→gc→commit→fold pipeline with structural", async () => {
    const prog = appS(geomPlugin.ctors.point({ x: mul(2, 3), y: add(4, 5) }));
    const { interp } = createTestInterp();

    // First fold: mul and add
    const r1 = await fold(prog, interp);
    expect(r1).toEqual({ x: 6, y: 9 });

    // Mutate: replace mul with sub
    const d = dirty(prog);
    const d2 = pipe(
      d as any,
      (x: any) => replaceWhere(x, byKind("num/mul"), "num/sub"),
      (x: any) => gc(x),
      (x: any) => commit(x),
    );

    // Second fold: sub and add
    const r2 = await fold(d2 as any, interp);
    expect(r2).toEqual({ x: -1, y: 9 }); // 2-3, 4+5
  });
});

// ═════════════════════════════════════════════════════════════════════
// selectWhere finds nodes inside structural subtrees
// ═════════════════════════════════════════════════════════════════════

describe("selectWhere reaches structural subtree nodes", () => {
  it("finds literals inside a structural point", () => {
    const prog = appS(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const lits = selectWhere(prog, byKind("num/literal"));
    expect(lits.size).toBe(2);
  });

  it("finds add nodes inside a structural point", () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: add(3, 4) }));
    const adds = selectWhere(prog, byKind("num/add"));
    expect(adds.size).toBe(2);
  });

  it("finds nested nodes inside structural + arithmetic", () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(mul(1, 2), 3), y: 4 }));
    const muls = selectWhere(prog, byKind("num/mul"));
    expect(muls.size).toBe(1);
    const adds = selectWhere(prog, byKind("num/add"));
    expect(adds.size).toBe(1);
  });
});
