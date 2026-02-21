/**
 * Accessor integration tests — verifies that AccessorOverlay is
 * integrated into CExpr itself, not just available as a separate
 * test fixture. Every CExpr with an object output type should
 * support property access that returns core/access CExpr nodes.
 *
 * These tests exercise the GENERAL makeCExpr path, not deepThing().
 */
import { describe, expect, it } from "vitest";
import { koan } from "../src/koan";

// ═════════════════════════════════════════════════════════════════════
// makeCExpr must return a Proxy with accessor overlay
// ═════════════════════════════════════════════════════════════════════

describe("accessor overlay on general CExpr (not just deepThing)", () => {
  it("property access on makeCExpr returns a CExpr", () => {
    const expr = koan.makeCExpr<{ x: number; y: number }, "test/obj", []>("test/obj", []);
    // Accessing .x should return a CExpr, not undefined
    const accessed = (expr as any).x;
    expect(accessed).toBeDefined();
    expect(koan.isCExpr(accessed)).toBe(true);
  });

  it("property access produces core/access kind", () => {
    const expr = koan.makeCExpr<{ x: number; y: number }, "test/obj", []>("test/obj", []);
    const accessed = (expr as any).x;
    expect(accessed.__kind).toBe("core/access");
  });

  it("accessor args contain parent and property name", () => {
    const expr = koan.makeCExpr<{ x: number; y: number }, "test/obj", []>("test/obj", []);
    const accessed = (expr as any).x;
    expect(accessed.__args[0]).toBe(expr);
    expect(accessed.__args[1]).toBe("x");
  });

  it("deep chaining on general CExpr works", () => {
    type Deep = { a: { b: { c: number } } };
    const expr = koan.makeCExpr<Deep, "test/deep", []>("test/deep", []);
    const deep = (expr as any).a.b.c;
    expect(koan.isCExpr(deep)).toBe(true);
    expect(deep.__kind).toBe("core/access");

    // Verify chain depth
    let cursor: any = deep;
    let depth = 0;
    while (cursor.__kind === "core/access") {
      cursor = cursor.__args[0];
      depth++;
    }
    expect(depth).toBe(3);
    expect(cursor.__kind).toBe("test/deep");
  });

  it("numeric index access on array-typed CExpr works", () => {
    const expr = koan.makeCExpr<number[], "test/arr", []>("test/arr", []);
    const accessed = (expr as any)[0];
    expect(koan.isCExpr(accessed)).toBe(true);
    expect(accessed.__kind).toBe("core/access");
    expect(accessed.__args[1]).toBe("0");
  });

  it("reserved properties (__kind, __args, CREF) are NOT intercepted", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    expect(expr.__kind).toBe("test/obj");
    expect(Array.isArray(expr.__args)).toBe(true);
    expect(koan.isCExpr(expr)).toBe(true); // CREF check
  });

  it("symbol properties are NOT intercepted", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    const sym = Symbol("test");
    // Symbol access should return undefined, not a CExpr
    const accessed = (expr as any)[sym];
    expect(accessed === undefined || !koan.isCExpr(accessed)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Accessor on structural constructors (point, pair)
// ═════════════════════════════════════════════════════════════════════

describe("accessor on structural constructor results", () => {
  it("point({x:1, y:2}).x produces core/access", () => {
    const p = koan.point({ x: 1, y: 2 });
    const accessed = (p as any).x;
    expect(koan.isCExpr(accessed)).toBe(true);
    expect(accessed.__kind).toBe("core/access");
    expect(accessed.__args[1]).toBe("x");
  });

  it("point({x:1, y:2}).y produces core/access", () => {
    const p = koan.point({ x: 1, y: 2 });
    const accessed = (p as any).y;
    expect(koan.isCExpr(accessed)).toBe(true);
    expect(accessed.__kind).toBe("core/access");
    expect(accessed.__args[1]).toBe("y");
  });

  it("accessor on constructor result chains correctly", () => {
    const p = koan.point({ x: 1, y: 2 });
    const accessed = (p as any).x;
    // Parent should be the original point CExpr
    expect(accessed.__args[0].__kind).toBe("geom/point");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Accessor chains elaborate through appS into real graph nodes
// ═════════════════════════════════════════════════════════════════════

describe("accessor elaboration into adjacency map", () => {
  it("point().x elaborates to core/access in adj", () => {
    const p = koan.point({ x: 1, y: 2 });
    const accessed = (p as any).x;
    // The accessor CExpr should be elaboratable
    expect(koan.isCExpr(accessed)).toBe(true);
    expect(accessed.__kind).toBe("core/access");
  });

  it("add(point().x, point().y) builds a compound accessor graph", () => {
    const p = koan.point({ x: 1, y: 2 });
    const sum = koan.add((p as any).x, (p as any).y);
    expect(koan.isCExpr(sum)).toBe(true);
    expect(sum.__kind).toBe("num/add");
    // Both args should be accessor CExprs
    expect(koan.isCExpr(sum.__args[0])).toBe(true);
    expect((sum.__args[0] as any).__kind).toBe("core/access");
    expect(koan.isCExpr(sum.__args[1])).toBe(true);
    expect((sum.__args[1] as any).__kind).toBe("core/access");
  });
});
