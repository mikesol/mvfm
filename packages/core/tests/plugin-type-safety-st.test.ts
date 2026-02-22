/**
 * Type-safety tests for the st (state) plugin.
 *
 * Proves that swapEntry and rewireChildren catch output-type
 * mismatches at the type level. All st kinds output `unknown`,
 * so we contrast against `num/literal` (output: number) and
 * `str/literal` (output: string) to create type mismatches.
 */
import { describe, it } from "vitest";
import type { DirtyExpr, NodeEntry } from "../src/index";
import { rewireChildren, swapEntry } from "../src/index";

// ─── Known adj shape for type-level tests ────────────────────────

type StAdj = {
  v1: NodeEntry<"num/literal", [], number>;
  id1: NodeEntry<"str/literal", [], string>;
  body1: NodeEntry<"st/let", ["v1", "id1"], unknown>;
  get1: NodeEntry<"st/get", ["id1"], unknown>;
};

/** Helper: create a DirtyExpr with a known StAdj type. */
function makeFakeDirty(): DirtyExpr<unknown, "body1", StAdj, "n5"> {
  return {
    __id: "body1",
    __adj: {
      v1: { kind: "num/literal", children: [], out: 0 },
      id1: { kind: "str/literal", children: [], out: "" },
      body1: { kind: "st/let", children: ["v1", "id1"], out: undefined },
      get1: { kind: "st/get", children: ["id1"], out: undefined },
    },
    __counter: "n5",
  } as unknown as DirtyExpr<unknown, "body1", StAdj, "n5">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("st plugin type safety", () => {
  it("swapEntry preserving number output compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "v1", {
      kind: "num/add" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing number to boolean is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "v1", {
      kind: "bool/literal" as const,
      children: [] as [],
      out: true as boolean,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving string output compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "id1", {
      kind: "str/concat" as const,
      children: [] as [],
      out: "" as string,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing string to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "id1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "v1", "v1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren different output types is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "v1", "id1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
