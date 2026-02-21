/**
 * Dirty type-safety — tests that rewireChildren and swapEntry reject
 * (at the type level) when output types are incompatible.
 *
 * Uses itePlugin: ite(boolean, number, number) → number
 */
import { describe, expect, it } from "vitest";
import type { CExpr, DirtyExpr, KindSpec, NodeEntry, Plugin } from "../src/index";
import {
  add,
  boolPluginU,
  commit,
  createApp,
  dirty,
  eq,
  fold,
  makeCExpr,
  numPluginU,
  ordPlugin,
  rewireChildren,
  strPluginU,
  swapEntry,
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
// Runtime: rewireChildren and swapEntry can corrupt output types
// ═════════════════════════════════════════════════════════════════════

describe("rewireChildren type mismatches produce wrong runtime results", () => {
  it("rewire boolean child to number child in ite cond slot", async () => {
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), add(1, 2), 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    const adj = prog.__adj;
    const eqId = Object.keys(adj).find((k) => adj[k].kind === "num/eq")!;
    const addId = Object.keys(adj).find((k) => adj[k].kind === "num/add")!;

    const d = dirty(prog);
    const rewired = rewireChildren(d, eqId, addId);
    const committed = commit(rewired as any);
    const r2 = await fold(committed as any, interp);
    expect(r2).toBe(3); // Wrong: should be 200 (eq was false)
  });
});

describe("swapEntry type mismatches produce wrong runtime results", () => {
  it("swap boolean entry with number entry → parent gets wrong type", async () => {
    const prog = appC(itePlugin.ctors.ite(eq(3, 10), 100, 200));
    const { interp } = createTestInterp();
    interp["ctrl/ite"] = async function* () {
      const cond = yield 0;
      if (cond) return yield 1;
      return yield 2;
    };

    const r1 = await fold(prog, interp);
    expect(r1).toBe(200);

    const adj = prog.__adj;
    const eqId = Object.keys(adj).find((k) => adj[k].kind === "num/eq")!;
    const eqEntry = adj[eqId];

    const d = dirty(prog);
    const swapped = swapEntry(d, eqId, {
      kind: "num/add",
      children: eqEntry.children,
      out: 0 as number,
    });
    const committed = commit(swapped as any);
    const r2 = await fold(committed as any, interp);
    expect(r2).toBe(100); // Wrong: eq(3,10) was false → should be 200
  });
});

// ═════════════════════════════════════════════════════════════════════
// Type-level: error types prevent use of invalid operations.
// Uses explicit Adj types for precise type-level checking.
// ═════════════════════════════════════════════════════════════════════

// Known adj shape for type-level tests
type TestAdj = {
  n1: NodeEntry<"num/lit", [], number>;
  n2: NodeEntry<"bool/lit", [], boolean>;
  n3: NodeEntry<"ctrl/ite", ["n2", "n1", "n1"], number>;
};

/** Helper: create a DirtyExpr with a known Adj type backed by real runtime data. */
function makeFakeDirty(): DirtyExpr<number, "n3", TestAdj, "n4"> {
  return {
    __id: "n3",
    __adj: {
      n1: { kind: "num/lit", children: [], out: 0 },
      n2: { kind: "bool/lit", children: [], out: false },
      n3: { kind: "ctrl/ite", children: ["n2", "n1", "n1"], out: 0 },
    },
    __counter: "n4",
  } as unknown as DirtyExpr<number, "n3", TestAdj, "n4">;
}

describe("dirty type mismatches caught at type level", () => {
  it("rewireChildren same out type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "n1", "n1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren different out type is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "n1", "n2");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("swapEntry preserving out compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "n1", {
      kind: "num/sub" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing out is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "n1", {
      kind: "bool/lit" as const,
      children: [] as [],
      out: true as boolean,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });
});
