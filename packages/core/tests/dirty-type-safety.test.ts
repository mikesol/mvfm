import { describe, expect, it } from "vitest";

import type { DirtyExpr, NodeEntry } from "../src/koan";
import { koan } from "../src/koan";

type TestAdj = {
  n1: NodeEntry<"num/lit", [], number>;
  n2: NodeEntry<"bool/lit", [], boolean>;
  n3: NodeEntry<"ctrl/ite", ["n2", "n1", "n1"], number>;
};

function makeFakeDirty(): DirtyExpr<number, "n3", TestAdj, "n4"> {
  return {
    __id: "n3",
    __counter: "n4",
    __adj: {
      n1: { kind: "num/lit", children: [], out: 7 },
      n2: { kind: "bool/lit", children: [], out: false },
      n3: { kind: "ctrl/ite", children: ["n2", "n1", "n1"], out: undefined },
    },
  } as unknown as DirtyExpr<number, "n3", TestAdj, "n4">;
}

describe("dirty mutation type safety", () => {
  it("runtime corruption: rewire bool cond to number child changes branch", async () => {
    const dirty = {
      __id: "root",
      __counter: "z",
      __adj: {
        b: { kind: "bool/lit", children: [], out: false },
        t: { kind: "num/lit", children: [], out: 5 },
        e: { kind: "num/lit", children: [], out: 9 },
        root: { kind: "ctrl/ite", children: ["b", "t", "e"], out: undefined },
      },
    } as unknown as DirtyExpr<number, "root", any, "z">;
    const rewired = koan.rewireChildren(dirty as any, "b", "t");
    const interp = {
      "num/lit": async function* (entry: { out: unknown }) {
        yield* [];
        return entry.out as number;
      },
      "bool/lit": async function* (entry: { out: unknown }) {
        yield* [];
        return entry.out as boolean;
      },
      "ctrl/ite": async function* () {
        const cond = yield 0;
        if (cond) return yield 1;
        return yield 2;
      },
    } as const;
    const result = await koan.fold("root", (rewired as any).__adj, interp as any);
    expect(result).toBe(5);
  });

  it("runtime corruption: swapEntry can change expected slot meaning", async () => {
    const dirty = {
      __id: "root",
      __counter: "z",
      __adj: {
        b: { kind: "bool/lit", children: [], out: false },
        t: { kind: "num/lit", children: [], out: 5 },
        e: { kind: "num/lit", children: [], out: 9 },
        root: { kind: "ctrl/ite", children: ["b", "t", "e"], out: undefined },
      },
    } as unknown as DirtyExpr<number, "root", any, "z">;
    const swapped = koan.swapEntry(dirty as any, "b", { kind: "num/lit", children: [], out: 2 });
    const interp = {
      "num/lit": async function* (entry: { out: unknown }) {
        yield* [];
        return entry.out as number;
      },
      "bool/lit": async function* (entry: { out: unknown }) {
        yield* [];
        return entry.out as boolean;
      },
      "ctrl/ite": async function* () {
        const cond = yield 0;
        if (cond) return yield 1;
        return yield 2;
      },
    } as const;
    const result = await koan.fold("root", (swapped as any).__adj, interp as any);
    expect(result).toBe(5);
  });
});

const fake = makeFakeDirty();
const okRewire = koan.rewireChildren(fake, "n1", "n1");
const _okRewire: DirtyExpr<any, any, any, any> = okRewire;
// @ts-expect-error rewire bool slot to number slot is now type-unsafe
const _badRewire: DirtyExpr<any, any, any, any> = koan.rewireChildren(fake, "n2", "n1");

const okSwap = koan.swapEntry(fake, "n2", { kind: "bool/lit", children: [], out: true });
const _okSwap: DirtyExpr<any, any, any, any> = okSwap;
// @ts-expect-error swapping bool node with number node is type-unsafe
const _badSwap: DirtyExpr<any, any, any, any> = koan.swapEntry(fake, "n2", {
  kind: "num/lit",
  children: [],
  out: 1,
});
