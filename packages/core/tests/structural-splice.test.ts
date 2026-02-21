/**
 * Structural splice — tests that spliceWhere correctly handles nodes
 * referenced inside structural Record/Array children, not just flat
 * string[] children.
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
  spliceWhere,
  strPluginU,
} from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ─── Structural plugin ──────────────────────────────────────────────

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
// spliceWhere must reach inside structural children
// ═════════════════════════════════════════════════════════════════════

describe("spliceWhere with structural children", () => {
  it("splicing add nodes inside a point reconnects to add's children", () => {
    // point({ x: add(1, 2), y: 3 }) — splice away all add nodes
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));

    // Verify the add node exists before splice
    const addsBefore = Object.values(prog.__adj).filter((e) => e.kind === "num/add");
    expect(addsBefore.length).toBe(1);

    const spliced = spliceWhere(prog, byKind("num/add"));

    // The add node should be gone
    const addsAfter = Object.values(spliced.__adj).filter((e) => e.kind === "num/add");
    expect(addsAfter.length).toBe(0);

    // The structural record should now reference the add's children directly
    const root = spliced.__adj[spliced.__id];
    expect(root.kind).toBe("geom/point");
    const childMap = root.children[0] as unknown as Record<string, unknown>;
    // x should now point to one of add's former children (a literal)
    const xEntry = spliced.__adj[childMap.x as string];
    expect(xEntry).toBeDefined();
    expect(xEntry.kind).toBe("num/literal");
  });

  it("spliced structural graph still passes commit validation", () => {
    const prog = appS(geomPlugin.ctors.point({ x: add(1, 2), y: 3 }));
    const spliced = spliceWhere(prog, byKind("num/add"));
    const d = dirty(spliced);
    const cleaned = gc(d);
    // If splice correctly updated structural refs, commit should not throw
    expect(() => commit(cleaned as any)).not.toThrow();
  });

  it("spliced structural graph folds correctly", async () => {
    // point({ x: add(10, 20), y: 3 }) — splice add, x becomes 10 (first child)
    const prog = appS(geomPlugin.ctors.point({ x: add(10, 20), y: 3 }));
    const spliced = spliceWhere(prog, byKind("num/add"));
    const { interp } = createTestInterp();
    // After splicing add, x should be the first child of the former add (10)
    const result = await fold(spliced as any, interp);
    expect(result).toEqual({ x: 10, y: 3 });
  });

  it("splice mul inside nested arithmetic in structural child", async () => {
    // point({ x: add(mul(2,3), 4), y: 5 }) — splice mul
    // mul(2,3) has children [lit(2), lit(3)], splice picks child[0] = lit(2)
    // so add gets [lit(2), lit(4)] — add yields 2 + 4 = 6
    const prog = appS(geomPlugin.ctors.point({ x: add(mul(2, 3), 4), y: 5 }));
    const spliced = spliceWhere(prog, byKind("num/mul"));

    // mul should be gone
    const muls = Object.values(spliced.__adj).filter((e) => e.kind === "num/mul");
    expect(muls.length).toBe(0);

    // add should still be there, with its first child now being a literal (was mul)
    const adds = Object.entries(spliced.__adj).filter(([, e]) => e.kind === "num/add");
    expect(adds.length).toBe(1);
    const addEntry = adds[0][1];
    // add's first child should now be lit(2) — mul was spliced, child[0] picked
    expect(spliced.__adj[addEntry.children[0]].kind).toBe("num/literal");

    // Fold: add(2, 4) — add yields child[0]+child[1] = 2+4 = 6, y = 5
    const { interp } = createTestInterp();
    const result = await fold(spliced as any, interp);
    expect(result).toEqual({ x: 6, y: 5 });
  });

  it("splice does not corrupt structural record when no match inside", () => {
    // point({ x: 3, y: 4 }) — splice add (no add exists inside)
    const prog = appS(geomPlugin.ctors.point({ x: 3, y: 4 }));
    const spliced = spliceWhere(prog, byKind("num/add"));

    // Nothing should change — graph should be identical
    expect(Object.keys(spliced.__adj).length).toBe(Object.keys(prog.__adj).length);

    // commit should pass
    const d = dirty(spliced);
    expect(() => commit(d as any)).not.toThrow();
  });
});
