/**
 * Type-safety guards — negative tests for DirtyExpr boundaries,
 * MapTypeError, SwapTypeError, and RewireTypeError.
 *
 * Verifies that the type system prevents:
 * - Passing DirtyExpr to NExpr-expecting functions without commit()
 * - Using MapTypeError results as DirtyExpr or NExpr
 * - Using SwapTypeError/RewireTypeError results as DirtyExpr
 */
import { describe, test } from "vitest";
import {
  add,
  app,
  byKind,
  commit,
  type DirtyExpr,
  dirty,
  eq,
  mapWhere,
  mul,
  type NExpr,
  numLit,
  replaceWhere,
  rewireChildren,
  swapEntry,
  wrapByName,
} from "../../src/index";

// =========================================================================
// DirtyExpr return boundary — replaceWhere/mapWhere/wrapByName
// =========================================================================
describe("DirtyExpr return boundary", () => {
  test("replaceWhere returns DirtyExpr, not NExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const replaced = replaceWhere(prog, byKind("num/add"), "num/sub");
    // @ts-expect-error — DirtyExpr is not NExpr
    const _bad: NExpr<any, any, any, any> = replaced;
  });

  test("mapWhere with preserved out returns DirtyExpr, not NExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const mapped = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      children: e.children,
      out: e.out,
    }));
    // @ts-expect-error — DirtyExpr is not NExpr
    const _bad: NExpr<any, any, any, any> = mapped;
  });

  test("wrapByName returns DirtyExpr, not NExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const wrapped = wrapByName(prog, "c", "debug/wrap");
    // @ts-expect-error — DirtyExpr is not NExpr
    const _bad: NExpr<any, any, any, any> = wrapped;
  });

  test("commit converts DirtyExpr back to NExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const replaced = replaceWhere(prog, byKind("num/add"), "num/sub");
    const committed = commit(replaced);
    const _ok: NExpr<any, any, any, any> = committed;
  });

  test("chaining without commit is allowed", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const chained = replaceWhere(
      replaceWhere(prog, byKind("num/add"), "num/sub"),
      byKind("num/mul"),
      "num/add",
    );
    // @ts-expect-error — DirtyExpr is not NExpr
    const _bad: NExpr<any, any, any, any> = chained;
    // But commit works
    const _ok: NExpr<any, any, any, any> = commit(chained);
  });
});

// =========================================================================
// MapTypeError — mapWhere output type mismatch
// =========================================================================
describe("MapTypeError boundary", () => {
  test("mapWhere changing out type is not DirtyExpr", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const mapped = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/add" as const,
      children: e.children,
      out: "wrong" as string,
    }));
    // @ts-expect-error — MapTypeError is not DirtyExpr
    const _bad: DirtyExpr<any, any, any, any> = mapped;
  });

  test("MapTypeError is not NExpr either", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const mapped = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/add" as const,
      children: e.children,
      out: true as boolean,
    }));
    // @ts-expect-error — MapTypeError is not NExpr
    const _bad: NExpr<any, any, any, any> = mapped;
  });
});

// =========================================================================
// SwapTypeError / RewireTypeError — dirty operation type mismatches
// =========================================================================
describe("SwapTypeError / RewireTypeError boundary", () => {
  test("swapEntry changing out type returns SwapTypeError", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    const swapped = swapEntry(d, "c", {
      kind: "bool/lit" as const,
      children: [] as [],
      out: true as boolean,
    });
    // @ts-expect-error — SwapTypeError is not DirtyExpr
    const _bad: DirtyExpr<any, any, any, any> = swapped;
  });

  test("swapEntry preserving out type compiles", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const d = dirty(prog);
    const swapped = swapEntry(d, "c", {
      kind: "num/sub" as const,
      children: ["a", "b"] as ["a", "b"],
      out: 0 as number,
    });
    const _ok: DirtyExpr<any, any, any, any> = swapped;
  });

  test("rewireChildren with incompatible out returns RewireTypeError", () => {
    const prog = app(eq(add(3, 4), add(5, 6)));
    const d = dirty(prog);
    const rewired = rewireChildren(d, "g", "c");
    // @ts-expect-error — RewireTypeError is not DirtyExpr
    const _bad: DirtyExpr<any, any, any, any> = rewired;
  });

  test("rewireChildren with same out type compiles", () => {
    const prog = app(add(3, 4));
    const d = dirty(prog);
    const rewired = rewireChildren(d, "a", "b");
    const _ok: DirtyExpr<any, any, any, any> = rewired;
  });
});
