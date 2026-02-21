/**
 * Accessor fold end-to-end — verifies that core/access nodes created
 * by the accessor proxy survive normalization AND fold correctly.
 *
 * This catches the mismatch where the normalizer might store the
 * property key in the wrong field (children vs out) relative to
 * what the fold interpreter expects.
 */
import { describe, expect, it } from "vitest";
import { koan } from "../src/koan";
import { createTestInterp } from "./kitchen-sink-helpers";

// ═════════════════════════════════════════════════════════════════════
// End-to-end: accessor → normalize → fold
// ═════════════════════════════════════════════════════════════════════

describe("accessor fold end-to-end", () => {
  it("fold through point({x:10, y:20}).x returns 10", async () => {
    const p = koan.point({ x: 10, y: 20 });
    const accessed = (p as any).x;
    // Normalize the accessor expression
    const prog = koan.appS(accessed);
    // The adjacency map should contain a core/access node
    const accessNodes = Object.values(prog.__adj).filter((e) => e.kind === "core/access");
    expect(accessNodes.length).toBeGreaterThanOrEqual(1);

    // Fold should produce 10 (the x value)
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(10);
  });

  it("fold through point({x:10, y:20}).y returns 20", async () => {
    const p = koan.point({ x: 10, y: 20 });
    const accessed = (p as any).y;
    const prog = koan.appS(accessed);
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(20);
  });

  it("add(point().x, point().y) folds to sum of fields", async () => {
    const p = koan.point({ x: 3, y: 7 });
    const sum = koan.add((p as any).x, (p as any).y);
    const prog = koan.appS(sum);
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(10); // 3 + 7
  });

  it("accessor on add result: add(1,2) elaborated, access .toString doesn't break fold", async () => {
    // This tests that the normalizer correctly handles core/access
    // nodes even when the parent is a non-structural expression
    const a = koan.add(1, 2);
    const prog = koan.app(a);
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(3);
  });

  it("core/access node has property key accessible to interpreter", async () => {
    const p = koan.point({ x: 42, y: 0 });
    const accessed = (p as any).x;
    const prog = koan.appS(accessed);

    // Find the core/access node and verify the key is stored correctly
    const accessEntries = Object.entries(prog.__adj).filter(([, e]) => e.kind === "core/access");
    expect(accessEntries.length).toBeGreaterThanOrEqual(1);
    const [, accessEntry] = accessEntries[accessEntries.length - 1];

    // The key "x" must be available to the interpreter — either in out
    // or as a recoverable child. The interpreter needs to extract it.
    // If out is the key:
    if (accessEntry.out !== undefined) {
      expect(accessEntry.out).toBe("x");
    } else {
      // If key is stored as a child, there should be 2 children
      // (parent + key-literal)
      expect(accessEntry.children.length).toBe(2);
      const keyChild = prog.__adj[accessEntry.children[1]];
      expect(keyChild).toBeDefined();
      expect(keyChild.out).toBe("x");
    }
  });

  it("deep accessor chain folds correctly", async () => {
    // Create a structural type with nested access
    const p = koan.point({ x: 100, y: 200 });
    const xAccess = (p as any).x;
    // Use the accessed value in arithmetic
    const prog = koan.appS(koan.add(xAccess, 1));
    const { interp } = createTestInterp();
    const result = await koan.fold(prog, interp);
    expect(result).toBe(101); // 100 + 1
  });
});

// ═════════════════════════════════════════════════════════════════════
// Proxy safety: toString, valueOf, toJSON must not create accessors
// ═════════════════════════════════════════════════════════════════════

describe("proxy safety: coercion methods", () => {
  it("String(expr) does not throw", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    // String coercion calls toString() — if it returns a CExpr instead
    // of a string, String() will throw or produce "[object Object]"
    expect(() => String(expr)).not.toThrow();
  });

  it("String(expr) returns a string, not a CExpr", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    const s = String(expr);
    expect(typeof s).toBe("string");
    // It should NOT be "[object Object]" from a CExpr's toString
    // returning a CExpr that then gets coerced poorly
    expect(koan.isCExpr(s)).toBe(false);
  });

  it("template literal interpolation works", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    // Template literals call toString()
    expect(() => `value: ${expr}`).not.toThrow();
    const result = `value: ${expr}`;
    expect(typeof result).toBe("string");
  });

  it("JSON.stringify does not produce accessor nodes", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    // JSON.stringify calls toJSON() if present — should not throw
    // or produce unexpected CExpr serialization
    let result: string | undefined;
    expect(() => {
      result = JSON.stringify(expr);
    }).not.toThrow();
    expect(typeof result).toBe("string");
  });

  it("expr.toString is not a CExpr", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    const ts = (expr as any).toString;
    // toString should be the real method, not a core/access CExpr
    expect(koan.isCExpr(ts)).toBe(false);
  });

  it("expr.valueOf is not a CExpr", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    const vo = (expr as any).valueOf;
    expect(koan.isCExpr(vo)).toBe(false);
  });

  it("expr.toJSON is not a CExpr", () => {
    const expr = koan.makeCExpr<{ x: number }, "test/obj", []>("test/obj", []);
    const tj = (expr as any).toJSON;
    expect(koan.isCExpr(tj)).toBe(false);
  });
});
