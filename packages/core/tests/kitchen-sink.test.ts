/**
 * Kitchen-sink torture test (part 1) — exercises cross-cutting interactions
 * between structural elaboration, accessors, typeclasses, DAG ops, and fold.
 * Designed to break implementations that handle features in isolation
 * but fail when they interact.
 */
import { describe, expect, it } from "vitest";
import { koan } from "../src/koan";
import { createTestInterp } from "./kitchen-sink-helpers";

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1: Build → elaborate → fold → verify
// ═══════════════════════════════════════════════════════════════════════

describe("kitchen sink: elaboration + fold + DAG", () => {
  it("structural + typeclass + fold", async () => {
    const p = koan.appS(koan.point({ x: koan.add(1, 2), y: koan.mul(4, 5) }));
    const root = p.__adj[p.__id];
    expect(root.kind).toBe("geom/point");

    const childRef = root.children[0];
    expect(childRef).toBeDefined();

    const { interp } = createTestInterp();
    const result = await koan.fold(p, interp);
    expect(result).toEqual({ x: 3, y: 20 });
  });

  it("nested eq(eq(1,1), eq(2,2)) — typeclass on typeclass output", async () => {
    const prog = koan.app(koan.eq(koan.eq(1, 1), koan.eq(2, 2)));
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(true); // eq(true, true)
  });

  it("nested eq mismatch: eq(eq(1,2), eq(3,3)) → false", async () => {
    const prog = koan.app(koan.eq(koan.eq(1, 2), koan.eq(3, 3)));
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(false); // eq(false, true)
  });

  it("deep accessor chain elaborated into graph nodes", () => {
    const d = koan.deepThing();
    const evil = d.helloRecord.boy[3].am.i[0].mean;
    expect(koan.isCExpr(evil)).toBe(true);
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

  it("build → fold → dirty → mutate → commit → fold cycle", async () => {
    const prog1 = koan.app(koan.add(koan.mul(2, 3), 10));
    const { interp } = createTestInterp();
    const r1 = await koan.fold(prog1, interp);
    expect(r1).toBe(16); // 2*3 + 10

    // dirty → replace mul→add → commit → fold
    const d1 = koan.dirty(prog1);
    const d2 = koan.pipe(
      d1,
      (d) => koan.replaceWhere(d, koan.byKind("num/mul"), "num/add"),
      (d) => koan.gc(d),
      (d) => koan.commit(d),
    );
    const r2 = await koan.fold(d2, interp);
    expect(r2).toBe(15); // (2+3) + 10

    // select + name
    const leaves = koan.selectWhere(d2, koan.isLeaf());
    expect(leaves.size).toBeGreaterThan(0);

    const named = koan.name(d2, "sum", d2.__id);
    expect(named.__adj["@sum"]).toBeDefined();
    expect(named.__adj["@sum"].kind).toBe("@alias");
  });

  it("spliceWhere + name round-trip", async () => {
    const prog = koan.app(koan.add(1, koan.sub(10, 3)));
    const { interp } = createTestInterp();
    const r1 = await koan.fold(prog, interp);
    expect(r1).toBe(8); // 1 + (10-3)

    const subNodes = koan.selectWhere(prog, koan.byKind("num/sub"));
    expect(subNodes.size).toBe(1);
    const subId = [...subNodes][0];

    const named = koan.name(prog, "difference", subId);
    const aliasEntry = named.__adj["@difference"];
    expect(aliasEntry.children[0]).toBe(subId);
  });
});
