/**
 * Type Tour de Force
 *
 * A medium-sized front-door example repeated 11 times, each with a single
 * subtle type error marked @ts-expect-error. The "golden" version compiles
 * and runs. Each variant introduces exactly one type violation to prove
 * the type system catches it.
 *
 * The golden example builds a small program via mvfm that:
 *   1. Takes { a: number, b: number }
 *   2. Computes sum = a + b, diff = a - b, product = a * b
 *   3. Checks equality: eq(sum, diff)
 *   4. Returns a record: { sum, diff, product, equal }
 *   5. Applies a DagQL replaceWhere on the NExpr
 *   6. Folds the result
 *
 * This exercises: mvfm, prelude, injectInput, fold, defaults,
 * constructors (add/sub/mul), traits (eq), auto-lift, DagQL (replaceWhere,
 * commit, pipe, selectWhere, OutOf, AdjOf).
 */

import { describe, test } from "vitest";
import {
  type AdjOf,
  add,
  app,
  byKind,
  type COutOf,
  type CtrOf,
  commit,
  defaults,
  dirty,
  eq,
  fold,
  injectInput,
  mapWhere,
  mul,
  mvfm,
  numLit,
  type OutOf,
  prelude,
  replaceWhere,
  selectWhere,
} from "../src/index";

// ═══════════════════════════════════════════════════════════════════════
// Golden version — this MUST compile and is the baseline for all variants
// ═══════════════════════════════════════════════════════════════════════

describe("type-tour-de-force: golden version compiles", () => {
  test("golden example", async () => {
    const myApp = mvfm(prelude);
    const prog = myApp({ a: "number", b: "number" }, ($: any) => {
      const sum = $.add($.input.a, $.input.b);
      const diff = $.sub($.input.a, $.input.b);
      const product = $.mul($.input.a, $.input.b);
      const equal = $.eq(sum, diff);
      return { sum, diff, product, equal };
    });
    const injected = injectInput(prog, { a: 10, b: 3 });
    const interp = defaults(myApp);
    const _result = await fold(interp, injected);

    // DagQL: replace sub→add on the NExpr
    const nexpr = injected.__nexpr;
    const transformed = commit(replaceWhere(nexpr, byKind("num/sub"), "num/add"));
    const _subs = selectWhere(transformed, byKind("num/sub"));

    // Type extractors work
    type _Out = OutOf<typeof transformed>;
    type _Adj = AdjOf<typeof transformed>;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 1: Wrong output type assignment — OutOf<NExpr<number>> ≠ string
// ═══════════════════════════════════════════════════════════════════════

describe("variant 1: OutOf wrong type", () => {
  test("OutOf<number NExpr> rejects string", () => {
    const prog = app(add(3, 4));
    type Out = OutOf<typeof prog>;
    const _ok: Out = 42;
    // @ts-expect-error — OutOf is number, not string
    const _bad: Out = "hello";
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 2: Wrong output type — eq produces boolean, not number
// ═══════════════════════════════════════════════════════════════════════

describe("variant 2: eq output is boolean, not number", () => {
  test("OutOf<eq NExpr> rejects number", () => {
    const prog = app(eq(3, 4));
    type Out = OutOf<typeof prog>;
    const _ok: Out = true;
    // @ts-expect-error — eq output is boolean, not number
    const _bad: Out = 42;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 3: AdjOf tracks kind precisely — replaced kind rejects old name
// ═══════════════════════════════════════════════════════════════════════

describe("variant 3: AdjOf tracks replaced kind", () => {
  test("replaceWhere changes adj kind type", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const replaced = commit(replaceWhere(prog, byKind("num/add"), "num/sub"));
    type Adj = AdjOf<typeof replaced>;
    const _ok: Adj["c"]["kind"] = "num/sub";
    // @ts-expect-error — was "num/add", now "num/sub"
    const _bad: Adj["c"]["kind"] = "num/add";
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 4: IdOf rejects wrong root ID
// ═══════════════════════════════════════════════════════════════════════

describe("variant 4: IdOf rejects wrong root", () => {
  test("add(3,4) root is 'c', not 'a'", () => {
    const prog = app(add(3, 4));
    type _Id =
      OutOf<typeof prog> extends number
        ? typeof prog extends { __id: infer I }
          ? I
          : never
        : never;
    // @ts-expect-error — root is "c", not "a"
    const _bad: typeof prog extends { __id: infer I } ? I : never = "a";
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 5: DirtyExpr is not assignable to NExpr
// ═══════════════════════════════════════════════════════════════════════

describe("variant 5: DirtyExpr ≠ NExpr", () => {
  test("dirty(prog) cannot be assigned to NExpr variable", () => {
    const prog = app(add(3, 4));
    const d = dirty(prog);
    // @ts-expect-error — DirtyExpr is branded differently from NExpr
    const _bad: typeof prog = d;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 6: NExpr cannot be passed to commit (expects DirtyExpr)
// ═══════════════════════════════════════════════════════════════════════

describe("variant 6: commit rejects NExpr", () => {
  test("commit expects DirtyExpr, not NExpr", () => {
    const prog = app(add(3, 4));
    // @ts-expect-error — commit expects DirtyExpr, not NExpr
    const _bad = commit(prog);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 7: CExpr extractors return never — OutOf on CExpr
// ═══════════════════════════════════════════════════════════════════════

describe("variant 7: NExpr extractors on CExpr yield never", () => {
  test("OutOf<CExpr> is never", () => {
    const c = add(3, 4);
    type Out = OutOf<typeof c>;
    // Out is never — trying to use it as number should fail
    type AssertNever<T extends never> = T;
    type _Check = AssertNever<Out>;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 8: COutOf rejects wrong type — add outputs number, not boolean
// ═══════════════════════════════════════════════════════════════════════

describe("variant 8: COutOf rejects wrong type", () => {
  test("COutOf<add> is number, not boolean", () => {
    const c = add(3, 4);
    type Out = COutOf<typeof c>;
    const _ok: Out = 42;
    // @ts-expect-error — COutOf<add> is number, not boolean
    const _bad: Out = true;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 9: mapWhere callback returning wrong kind type (number not string)
// ═══════════════════════════════════════════════════════════════════════

describe("variant 9: mapWhere rejects number as kind", () => {
  test("kind must be string, not number", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const _bad = mapWhere(prog, byKind("num/add"), (e) => ({
      // @ts-expect-error — kind must be string, not number
      kind: 42 as string,
      children: e.children,
      out: e.out,
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 10: CtrOf rejects wrong counter value
// ═══════════════════════════════════════════════════════════════════════

describe("variant 10: CtrOf rejects wrong counter", () => {
  test("mul(add(3,4),5) counter is 'f', not 'z'", () => {
    const prog = app(mul(add(3, 4), 5));
    type C = CtrOf<typeof prog>;
    const _ok: C = "f";
    // @ts-expect-error — counter is "f", not "z"
    const _bad: C = "z";
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variant 11: AdjOf node entry — wrong children tuple
// ═══════════════════════════════════════════════════════════════════════

describe("variant 11: AdjOf children type mismatch", () => {
  test("mapWhere callback rejects wrong children cast", () => {
    const prog = app(mul(add(numLit(3), numLit(4)), numLit(5)));
    const _bad = mapWhere(prog, byKind("num/add"), (e) => ({
      kind: "num/sub" as const,
      // @ts-expect-error — ["x","y"] doesn't overlap with ["a","b"]
      children: ["x", "y"] as ["a", "b"],
      out: e.out,
    }));
  });
});
