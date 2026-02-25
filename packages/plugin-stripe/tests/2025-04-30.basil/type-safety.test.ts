/**
 * Type-safety tests for the stripe plugin.
 *
 * After the Liftable<T> migration, stripe/record and stripe/array
 * no longer exist. Tests use stripe kinds with their Stripe SDK
 * output types, and `num/literal` (output: number) as an external
 * contrasting type.
 */

import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { rewireChildren, swapEntry } from "@mvfm/core";
import type Stripe from "stripe";
import { describe, it } from "vitest";

// ─── Known adj shape for type-level tests ────────────────────────

type StripeAdj = {
  p1: NodeEntry<"stripe/create_payment_intent", ["c1"], Stripe.PaymentIntent>;
  c1: NodeEntry<"stripe/create_customer", [], Stripe.Customer>;
  n1: NodeEntry<"num/literal", [], number>;
};

/** Helper: create a DirtyExpr with a known StripeAdj type. */
function makeFakeDirty(): DirtyExpr<unknown, "p1", StripeAdj, "n5"> {
  return {
    __id: "p1",
    __adj: {
      p1: { kind: "stripe/create_payment_intent", children: ["c1"], out: undefined },
      c1: { kind: "stripe/create_customer", children: [], out: undefined },
      n1: { kind: "num/literal", children: [], out: 0 },
    },
    __counter: "n5",
  } as unknown as DirtyExpr<unknown, "p1", StripeAdj, "n5">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("stripe plugin type safety", () => {
  it("swapEntry preserving Customer output compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "c1", {
      kind: "stripe/create_customer" as const,
      children: [] as [],
      out: undefined as unknown as Stripe.Customer,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing Customer to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "c1", {
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

  it("swapEntry changing number to Customer is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "n1", {
      kind: "stripe/create_customer" as const,
      children: [] as [],
      out: undefined as unknown as Stripe.Customer,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "c1", "c1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren Customer to number is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "c1", "n1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
