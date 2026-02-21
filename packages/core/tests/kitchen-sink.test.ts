/**
 * Kitchen-sink torture test (part 1) — exercises cross-cutting interactions
 * between structural elaboration, accessors, typeclasses, DAG ops, and fold.
 * Designed to break implementations that handle features in isolation
 * but fail when they interact.
 */
import { describe, expect, it } from "vitest";
import type { CExpr, KindSpec, Plugin } from "../src/index";
import {
  add,
  app,
  boolPluginU,
  byKind,
  commit,
  createApp,
  dirty,
  eq,
  fold,
  gc,
  isCExpr,
  isLeaf,
  makeCExpr,
  mul,
  name,
  numPluginU,
  pipe,
  replaceWhere,
  selectWhere,
  strPluginU,
  sub,
} from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ─── Structural test plugins ────────────────────────────────────────

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
// PHASE 1: Build -> elaborate -> fold -> verify
// ═════════════════════════════════════════════════════════════════════

describe("kitchen sink: elaboration + fold + DAG", () => {
  it("structural + typeclass + fold", async () => {
    const p = appS(geomPlugin.ctors.point({ x: add(1, 2), y: mul(4, 5) }));
    const root = p.__adj[p.__id];
    expect(root.kind).toBe("geom/point");

    const childRef = root.children[0];
    expect(childRef).toBeDefined();

    const { interp } = createTestInterp();
    const result = await fold(p, interp);
    expect(result).toEqual({ x: 3, y: 20 });
  });

  it("nested eq(eq(1,1), eq(2,2)) — typeclass on typeclass output", async () => {
    const prog = app(eq(eq(1, 1), eq(2, 2)));
    const { interp } = createTestInterp();
    const result = await fold(prog, interp);
    expect(result).toBe(true); // eq(true, true)
  });

  it("nested eq mismatch: eq(eq(1,2), eq(3,3)) -> false", async () => {
    const prog = app(eq(eq(1, 2), eq(3, 3)));
    const { interp } = createTestInterp();
    const result = await fold(prog, interp);
    expect(result).toBe(false); // eq(false, true)
  });

  it("deep accessor chain elaborated into graph nodes", () => {
    type Deep = {
      helloRecord: { boy: { 3: { am: { i: { 0: { mean: number } } } } } };
    };
    const d = makeCExpr<Deep, "test/deep", []>("test/deep", []);
    const evil = d.helloRecord.boy[3].am.i[0].mean;
    expect(isCExpr(evil)).toBe(true);
    expect((evil as any).__kind).toBe("core/access");

    let cursor: any = evil;
    let depth = 0;
    while (cursor.__kind === "core/access") {
      cursor = cursor.__args[0];
      depth++;
    }
    expect(depth).toBe(7);
    expect(cursor.__kind).toBe("test/deep");
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: DAG manipulation interleaved with fold
  // ═══════════════════════════════════════════════════════════════════

  it("build -> fold -> dirty -> mutate -> commit -> fold cycle", async () => {
    const prog1 = app(add(mul(2, 3), 10));
    const { interp } = createTestInterp();
    const r1 = await fold(prog1, interp);
    expect(r1).toBe(16); // 2*3 + 10

    // dirty -> replace mul->add -> commit -> fold
    const d1 = dirty(prog1);
    const d2 = pipe(
      d1 as any,
      (d: any) => replaceWhere(d, byKind("num/mul"), "num/add"),
      (d: any) => gc(d),
      (d: any) => commit(d),
    );
    const r2 = await fold(d2 as any, interp);
    expect(r2).toBe(15); // (2+3) + 10

    // select + name
    const leaves = selectWhere(d2 as any, isLeaf());
    expect(leaves.size).toBeGreaterThan(0);

    const named = name(d2 as any, "sum", (d2 as any).__id);
    expect(named.__adj["@sum"]).toBeDefined();
    expect(named.__adj["@sum"].kind).toBe("@alias");
  });

  it("spliceWhere + name round-trip", async () => {
    const prog = app(add(1, sub(10, 3)));
    const { interp } = createTestInterp();
    const r1 = await fold(prog, interp);
    expect(r1).toBe(8); // 1 + (10-3)

    const subNodes = selectWhere(prog, byKind("num/sub"));
    expect(subNodes.size).toBe(1);
    const subId = [...subNodes][0];

    const named = name(prog, "difference", subId);
    const aliasEntry = named.__adj["@difference"];
    expect(aliasEntry.children[0]).toBe(subId);
  });
});
