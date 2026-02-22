/**
 * Type-safety tests for the redis plugin.
 *
 * Proves that swapEntry and rewireChildren catch output-type
 * mismatches at the type level. Key contrasts:
 *   - redis/get outputs `string | null`
 *   - redis/incr outputs `number`
 *   - redis/hgetall outputs `Record<string, string>`
 *   - redis/hkeys outputs `string[]`
 */
import { describe, it } from "vitest";
import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { rewireChildren, swapEntry } from "@mvfm/core";

// ─── Known adj shape for type-level tests ────────────────────────

type RedisAdj = {
  k1: NodeEntry<"str/literal", [], string>;
  g1: NodeEntry<"redis/get", ["k1"], string | null>;
  i1: NodeEntry<"redis/incr", ["k1"], number>;
  h1: NodeEntry<"redis/hgetall", ["k1"], Record<string, string>>;
  hk1: NodeEntry<"redis/hkeys", ["k1"], string[]>;
};

/** Helper: create a DirtyExpr with a known RedisAdj type. */
function makeFakeDirty(): DirtyExpr<string | null, "g1", RedisAdj, "n6"> {
  return {
    __id: "g1",
    __adj: {
      k1: { kind: "str/literal", children: [], out: "" },
      g1: { kind: "redis/get", children: ["k1"], out: null },
      i1: { kind: "redis/incr", children: ["k1"], out: 0 },
      h1: { kind: "redis/hgetall", children: ["k1"], out: {} },
      hk1: { kind: "redis/hkeys", children: ["k1"], out: [] },
    },
    __counter: "n6",
  } as unknown as DirtyExpr<string | null, "g1", RedisAdj, "n6">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("redis plugin type safety", () => {
  it("swapEntry preserving string|null output on get compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "g1", {
      kind: "redis/lpop" as const,
      children: [] as [],
      out: null as string | null,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing get string|null to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "g1", {
      kind: "redis/incr" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving number output on incr compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "i1", {
      kind: "redis/del" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing incr number to Record is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "i1", {
      kind: "redis/hgetall" as const,
      children: [] as [],
      out: {} as Record<string, string>,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "i1", "i1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren number to string|null is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "i1", "g1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
