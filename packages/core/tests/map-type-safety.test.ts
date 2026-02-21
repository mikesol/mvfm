/**
 * Map type-safety — tests that mapWhere rejects (at the type level)
 * when the callback changes the output type of matched nodes.
 *
 * Uses the itePlugin pattern from splice-type-safety.test.ts:
 * ite(boolean, number, number) → number
 */
import { describe, expect, it } from "vitest";
import type { CExpr, KindSpec, NExpr, Plugin } from "../src/index";
import {
  add,
  boolPluginU,
  byKind,
  commit,
  createApp,
  eq,
  fold,
  makeCExpr,
  mapWhere,
  numPluginU,
  ordPlugin,
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
// Runtime: mapWhere that changes out type corrupts the graph
// ═════════════════════════════════════════════════════════════════════

describe("mapWhere type mismatches produce wrong runtime results", () => {
  it("mapWhere changes eq out from boolean to number → ite gets number in boolean slot", async () => {
    // ite(eq(3, 10), 100, 200) — eq outputs boolean for cond slot
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    // Before map: eq(3,10) → false → ite picks else → 200
    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    // Map eq to a number-output node: corrupts the boolean slot
    const mapped = mapWhere(prog, byKind("num/eq"), (e) => ({
      kind: "num/add" as const,
      children: e.children,
      out: 0 as number,
    }));
    const r2 = await fold(mapped as any, interp);
    // add(3,10)=13, truthy → picks then → 100 (wrong: should be boolean false → 200)
    expect(r2).toBe(100);
  });

  it("mapWhere changes number branch to boolean → ite picks wrong branch", async () => {
    // ite(eq(3, 10), add(1, 2), 200) — add outputs number for then slot
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), add(1, 2), 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    // Before map: eq(3,10)=false → else → 200
    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    // Map add to eq (number→boolean output): changes then branch type
    const mapped = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/eq" as const,
      children: e.children,
      out: false as boolean,
    }));
    // The graph still works at runtime but the types are wrong:
    // then slot now outputs boolean instead of number
    const r2 = await fold(mapped as any, interp);
    // eq(1,2)=false, but ite still selects else=200; the type corruption is silent
    expect(r2).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Type-level: MapTypeError prevents use of invalid mapped results.
// ═════════════════════════════════════════════════════════════════════

describe("mapWhere type mismatches caught at type level", () => {
  it("mapWhere changing out type is not assignable to NExpr", () => {
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const mapped = mapWhere(prog, byKind("num/eq"), (e) => ({
      kind: "num/add" as const,
      children: e.children,
      out: 0 as number,
    }));
    // MapTypeError is not assignable to NExpr
    // @ts-expect-error — mapped is MapTypeError, not NExpr
    const _check: NExpr<any, any, any, any> = mapped;
    void _check;
  });

  it("mapWhere preserving out type should compile", () => {
    const prog = appC(add(1, 2));
    // Replace add with sub — same output type (number→number)
    const mapped = commit(
      mapWhere(prog, byKind("num/add"), (e) => ({
        kind: "num/sub" as const,
        children: e.children,
        out: e.out,
      })),
    );
    // This compiles — out type is preserved, result is NExpr
    const _check: NExpr<any, any, any, any> = mapped;
    void _check;
  });
});
