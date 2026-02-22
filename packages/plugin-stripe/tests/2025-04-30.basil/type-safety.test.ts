/**
 * Type-safety tests for the stripe plugin.
 *
 * Most stripe kinds output `unknown`, so we contrast against
 * `stripe/record` (output: Record<string, unknown>) and
 * `stripe/array` (output: unknown[]) to create type mismatches,
 * and also use `num/literal` (output: number) as an external
 * contrasting type.
 */

import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { rewireChildren, swapEntry } from "@mvfm/core";
import { describe, it } from "vitest";

// ─── Known adj shape for type-level tests ────────────────────────

type StripeAdj = {
  p1: NodeEntry<"stripe/create_payment_intent", ["rec1"], unknown>;
  rec1: NodeEntry<"stripe/record", [], Record<string, unknown>>;
  arr1: NodeEntry<"stripe/array", [], unknown[]>;
  n1: NodeEntry<"num/literal", [], number>;
};

/** Helper: create a DirtyExpr with a known StripeAdj type. */
function makeFakeDirty(): DirtyExpr<unknown, "p1", StripeAdj, "n5"> {
  return {
    __id: "p1",
    __adj: {
      p1: { kind: "stripe/create_payment_intent", children: ["rec1"], out: undefined },
      rec1: { kind: "stripe/record", children: [], out: {} },
      arr1: { kind: "stripe/array", children: [], out: [] },
      n1: { kind: "num/literal", children: [], out: 0 },
    },
    __counter: "n5",
  } as unknown as DirtyExpr<unknown, "p1", StripeAdj, "n5">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("stripe plugin type safety", () => {
  it("swapEntry preserving Record output on record compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "rec1", {
      kind: "stripe/record" as const,
      children: [] as [],
      out: {} as Record<string, unknown>,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing Record to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "rec1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving number output compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "n1", {
      kind: "num/add" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing number to array is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "n1", {
      kind: "stripe/array" as const,
      children: [] as [],
      out: [] as unknown[],
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "rec1", "rec1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren Record to number is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "rec1", "n1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
