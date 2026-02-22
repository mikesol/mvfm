/**
 * Type-safety tests for the fetch plugin.
 *
 * Proves that swapEntry and rewireChildren catch output-type
 * mismatches at the type level. Key contrasts:
 *   - fetch/status outputs `number`
 *   - fetch/text outputs `string`
 *   - fetch/headers outputs `Record<string, string>`
 *   - fetch/request outputs `unknown`
 */

import type { DirtyExpr, NodeEntry } from "@mvfm/core";
import { rewireChildren, swapEntry } from "@mvfm/core";
import { describe, it } from "vitest";

// ─── Known adj shape for type-level tests ────────────────────────

type FetchAdj = {
  u1: NodeEntry<"str/literal", [], string>;
  r1: NodeEntry<"fetch/request", ["u1"], unknown>;
  s1: NodeEntry<"fetch/status", ["r1"], number>;
  t1: NodeEntry<"fetch/text", ["r1"], string>;
  h1: NodeEntry<"fetch/headers", ["r1"], Record<string, string>>;
};

/** Helper: create a DirtyExpr with a known FetchAdj type. */
function makeFakeDirty(): DirtyExpr<number, "s1", FetchAdj, "n6"> {
  return {
    __id: "s1",
    __adj: {
      u1: { kind: "str/literal", children: [], out: "" },
      r1: { kind: "fetch/request", children: ["u1"], out: undefined },
      s1: { kind: "fetch/status", children: ["r1"], out: 0 },
      t1: { kind: "fetch/text", children: ["r1"], out: "" },
      h1: { kind: "fetch/headers", children: ["r1"], out: {} },
    },
    __counter: "n6",
  } as unknown as DirtyExpr<number, "s1", FetchAdj, "n6">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("fetch plugin type safety", () => {
  it("swapEntry preserving number output on status compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "s1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing status number to string is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "s1", {
      kind: "fetch/text" as const,
      children: [] as [],
      out: "" as string,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving string output on text compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "t1", {
      kind: "str/literal" as const,
      children: [] as [],
      out: "" as string,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing text string to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "t1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "s1", "s1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren number to string is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "s1", "t1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
