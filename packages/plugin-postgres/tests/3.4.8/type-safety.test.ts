/**
 * Type-safety tests for the postgres plugin.
 *
 * Proves that swapEntry and rewireChildren catch output-type
 * mismatches at the type level. Key contrasts:
 *   - postgres/query outputs `unknown[]`
 *   - postgres/cursor outputs `void`
 *   - postgres/identifier outputs `unknown`
 *   - num/literal outputs `number`
 */

import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { rewireChildren, swapEntry } from "@mvfm/core";
import { describe, it } from "vitest";

// ─── Known adj shape for type-level tests ────────────────────────

type PgAdj = {
  q1: NodeEntry<"postgres/query", ["n1"], unknown[]>;
  c1: NodeEntry<"postgres/cursor", ["q1", "n1", "b1"], void>;
  b1: NodeEntry<"postgres/cursor_batch", [], unknown[]>;
  n1: NodeEntry<"num/literal", [], number>;
};

/** Helper: create a DirtyExpr with a known PgAdj type. */
function makeFakeDirty(): DirtyExpr<unknown[], "q1", PgAdj, "n5"> {
  return {
    __id: "q1",
    __adj: {
      q1: { kind: "postgres/query", children: ["n1"], out: [] },
      c1: { kind: "postgres/cursor", children: ["q1", "n1", "b1"], out: undefined },
      b1: { kind: "postgres/cursor_batch", children: [], out: [] },
      n1: { kind: "num/literal", children: [], out: 0 },
    },
    __counter: "n5",
  } as unknown as DirtyExpr<unknown[], "q1", PgAdj, "n5">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("postgres plugin type safety", () => {
  it("swapEntry preserving unknown[] output on query compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "q1", {
      kind: "postgres/cursor_batch" as const,
      children: [] as [],
      out: [] as unknown[],
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing query unknown[] to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "q1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving void output on cursor compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "c1", {
      kind: "postgres/cursor" as const,
      children: [] as [],
      out: undefined as undefined,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing cursor void to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "c1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "q1", "b1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren unknown[] to number is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "q1", "n1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
