/**
 * Splice type-safety — tests that spliceWhere rejects (at the type level)
 * when the replacement child's output type doesn't match the spliced node's
 * output type.
 *
 * Key insight: splicing node X replaces X with X's child. If X outputs a
 * DIFFERENT type than its child (e.g. num/eq: number→boolean), the parent
 * of X was wired for X's output type but now receives the child's type.
 *
 * The type system returns `SpliceTypeError` for invalid splices, which is
 * not assignable to NExpr and thus rejected by fold/dirty/commit.
 */
import { describe, expect, it } from "vitest";
import type { CExpr, KindSpec, NExpr, Plugin } from "../src/index";
import {
  add,
  boolPluginU,
  byKind,
  createApp,
  eq,
  fold,
  makeCExpr,
  numPluginU,
  ordPlugin,
  spliceWhere,
  strPluginU,
} from "../src/index";
import { createTestInterp } from "./kitchen-sink-helpers";

// ─── Custom plugin: ite(boolean, number, number) → number ───────────

const itePlugin = {
  name: "ite",
  ctors: {
    ite: <C, T, E>(cond: C, then_: T, else_: E): CExpr<number, "ctrl/ite", [C, T, E]> =>
      makeCExpr("ctrl/ite", [cond, then_, else_]),
  },
  kinds: {
    "ctrl/ite": {
      inputs: [false, 0, 0],
      output: 0,
    } as KindSpec<[boolean, number, number], number>,
  },
  traits: {},
  lifts: {},
  nodeKinds: ["ctrl/ite"] as const,
  shapes: {},
} satisfies Plugin;

const appC = createApp(numPluginU, strPluginU, boolPluginU, ordPlugin, itePlugin);

// ═════════════════════════════════════════════════════════════════════
// Runtime: splice produces type-incorrect graphs that fold wrongly
// ═════════════════════════════════════════════════════════════════════

describe("splice type mismatches produce wrong runtime results", () => {
  it("splicing eq inside ite: number replaces boolean condition", async () => {
    // ite(eq(3, 10), 100, 200) — valid: eq outputs boolean for cond slot
    // Splice eq → picks child[0] = lit(3) (number) for the boolean slot
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    // Before splice: eq(3,10) → false → ite picks else → 200
    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    // After splice: ite(3, 100, 200) — 3 is truthy → picks then → 100
    const spliced = spliceWhere(prog, byKind("num/eq"));
    const r2 = await fold(spliced as any, interp);
    expect(r2).toBe(100); // JS truthiness corruption
  });

  it("splicing eq with childIndex=1 also corrupts", async () => {
    const prog = appC(itePlugin.ctors.ite(eq(0, 10), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    const spliced = spliceWhere(prog, byKind("num/eq"), 1);
    const r2 = await fold(spliced as any, interp);
    expect(r2).toBe(100);
  });

  it("splicing eq(0,...) is insidiously 'correct'", async () => {
    const prog = appC(itePlugin.ctors.ite(eq(0, 5), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    const spliced = spliceWhere(prog, byKind("num/eq"));
    const r2 = await fold(spliced as any, interp);
    expect(r2).toBe(200); // Accidentally same, semantically wrong
  });

  it("splicing eq(10,3) flips the result", async () => {
    const prog = appC(itePlugin.ctors.ite(eq(10, 3), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    const spliced = spliceWhere(prog, byKind("num/eq"));
    const r2 = await fold(spliced as any, interp);
    expect(r2).toBe(100); // WRONG
  });
});

// ═════════════════════════════════════════════════════════════════════
// Type-level: SpliceTypeError prevents use of invalid spliced results.
// Invalid splices return SpliceTypeError which is not assignable to NExpr.
// ═════════════════════════════════════════════════════════════════════

describe("splice type mismatches caught at type level", () => {
  it("splicing eq (boolean→number child) is not assignable to NExpr", () => {
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const spliced = spliceWhere(prog, byKind("num/eq"));
    // SpliceTypeError is not assignable to NExpr
    // @ts-expect-error — spliced is SpliceTypeError, not NExpr
    const _nexpr: NExpr<any, any, any, any> = spliced;
  });

  it("splicing eq with childIndex=1 is also type error", () => {
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const spliced = spliceWhere(prog, byKind("num/eq"), 1);
    // @ts-expect-error — spliced is SpliceTypeError, not NExpr
    const _nexpr: NExpr<any, any, any, any> = spliced;
  });

  it("valid splice: same output type is assignable to NExpr", async () => {
    // ite(eq(3,10), add(1,2), 4) — splice add: number→number OK
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), add(1, 2), 4));
    const spliced = spliceWhere(prog, byKind("num/add"));
    // Should compile — number replaces number, no SpliceTypeError
    const _nexpr: NExpr<any, any, any, any> = spliced;

    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };
    const result = await fold(spliced as any, interp);
    expect(result).toBe(4); // eq(3,10)=false → else → 4
  });
});
