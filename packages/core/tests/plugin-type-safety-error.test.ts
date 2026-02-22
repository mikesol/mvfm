/**
 * Type-safety tests for the error plugin.
 *
 * Proves that swapEntry and rewireChildren catch output-type
 * mismatches at the type level. Key contrast: error/caught outputs
 * `string` while error/try outputs `unknown`, and num/literal
 * outputs `number`.
 */
import { describe, it } from "vitest";
import type { DirtyExpr, NodeEntry } from "../src/index";
import { rewireChildren, swapEntry } from "../src/index";

// ─── Known adj shape for type-level tests ────────────────────────

type ErrorAdj = {
  body1: NodeEntry<"num/literal", [], number>;
  try1: NodeEntry<"error/try", ["body1"], unknown>;
  caught1: NodeEntry<"error/caught", ["try1"], string>;
};

/** Helper: create a DirtyExpr with a known ErrorAdj type. */
function makeFakeDirty(): DirtyExpr<unknown, "try1", ErrorAdj, "n4"> {
  return {
    __id: "try1",
    __adj: {
      body1: { kind: "num/literal", children: [], out: 0 },
      try1: { kind: "error/try", children: ["body1"], out: undefined },
      caught1: { kind: "error/caught", children: ["try1"], out: "" },
    },
    __counter: "n4",
  } as unknown as DirtyExpr<unknown, "try1", ErrorAdj, "n4">;
}

// ─── Type-level tests ────────────────────────────────────────────

describe("error plugin type safety", () => {
  it("swapEntry preserving string output on caught compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "caught1", {
      kind: "str/literal" as const,
      children: [] as [],
      out: "" as string,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing caught string to number is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "caught1", {
      kind: "num/literal" as const,
      children: [] as [],
      out: 0 as number,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry preserving number output on body compiles", () => {
    const swapped = swapEntry(makeFakeDirty(), "body1", {
      kind: "num/add" as const,
      children: [] as [],
      out: 0 as number,
    });
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("swapEntry changing body number to boolean is error", () => {
    const swapped = swapEntry(makeFakeDirty(), "body1", {
      kind: "bool/literal" as const,
      children: [] as [],
      out: true as boolean,
    });
    // @ts-expect-error — SwapTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = swapped;
    void _check;
  });

  it("rewireChildren same output type compiles", () => {
    const rewired = rewireChildren(makeFakeDirty(), "caught1", "caught1");
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });

  it("rewireChildren string to number is error", () => {
    const rewired = rewireChildren(makeFakeDirty(), "caught1", "body1");
    // @ts-expect-error — RewireTypeError, not DirtyExpr
    const _check: DirtyExpr<any, any, any, any> = rewired;
    void _check;
  });
});
