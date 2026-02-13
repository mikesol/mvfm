import { describe, expect, expectTypeOf, it } from "vitest";
import type { Expr } from "../src";
import { boolean, eq, ilo, num, semiring, str } from "../src";

const app = ilo(num, str, semiring);

describe("typed inputs (generic parameter)", () => {
  it("$.input.name resolves to Expr<string> when schema declares name: string", () => {
    app<{ name: string; age: number }>(($) => {
      expectTypeOf($.input.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.age).toEqualTypeOf<Expr<number>>();
      return $.input.name;
    });
  });

  it("$.input.x without a schema declaration is a type error", () => {
    app(($) => {
      // @ts-expect-error — no input schema declared (I=never), property access forbidden
      $.input.x;
      return $.add(1, 2);
    });
  });

  it("$.add($.input.name, 1) is a type error when name: string", () => {
    app<{ name: string }>(($) => {
      // @ts-expect-error — name is Expr<string>, not Expr<number>
      return $.add($.input.name, 1);
    });
  });

  it("nested record access preserves types", () => {
    app<{ user: { name: string; score: number } }>(($) => {
      expectTypeOf($.input.user).toEqualTypeOf<Expr<{ name: string; score: number }>>();
      expectTypeOf($.input.user.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.user.score).toEqualTypeOf<Expr<number>>();
      return $.input.user.name;
    });
  });

  it("Expr<string> is a leaf — no extra properties", () => {
    app<{ name: string }>(($) => {
      // @ts-expect-error — string is a leaf type, no .foo property
      $.input.name.foo;
      return $.input.name;
    });
  });
});

describe("typed inputs (runtime schema)", () => {
  it("$.input.name resolves to Expr<string> with schema", () => {
    app({ name: "string", age: "number" }, ($) => {
      expectTypeOf($.input.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.age).toEqualTypeOf<Expr<number>>();
      return $.input.name;
    });
  });

  it("nested schema preserves types", () => {
    app({ user: { name: "string", score: "number" } }, ($) => {
      expectTypeOf($.input.user.name).toEqualTypeOf<Expr<string>>();
      expectTypeOf($.input.user.score).toEqualTypeOf<Expr<number>>();
      return $.input.user.name;
    });
  });

  it("$.add($.input.name, 1) is a type error when name: 'string'", () => {
    expect(() =>
      app({ name: "string" }, ($) => {
        // @ts-expect-error — name is Expr<string>, not Expr<number>
        return $.add($.input.name, 1);
      }),
    ).toThrow();
  });
});

describe("typeclass type safety — negative tests", () => {
  it("eq without type plugins is a type error", () => {
    const app = ilo(eq);
    // Runtime: ilo(eq) with no type plugins throws when eq is actually called.
    // We only verify the type-level error here; wrap in expect().toThrow()
    // since the @ts-expect-error-suppressed calls still execute at runtime.
    expect(() =>
      app(($) => {
        // @ts-expect-error — no type plugin provides eq
        $.eq(1, 2);
        // @ts-expect-error — no type plugin provides neq
        $.neq(1, 2);
        return $.input;
      }),
    ).toThrow();
  });

  it("eq with only num rejects string arguments", () => {
    const app = ilo(num, eq);
    // Verify num eq typechecks and works at runtime
    const prog = app(($) => {
      const result = $.eq(1, 2);
      expectTypeOf(result).toEqualTypeOf<Expr<boolean>>();
      return result;
    });
    expect(prog.ast).toBeDefined();
    // Verify string eq is rejected at the type level (and throws at runtime)
    expect(() =>
      app(($) => {
        // @ts-expect-error — str not loaded, no eq for string
        return $.eq("a", "b");
      }),
    ).toThrow();
  });

  it("eq with num and str accepts both", () => {
    const app = ilo(num, str, eq);
    // Verify both num and str eq typecheck and work at runtime
    const prog = app(($) => {
      const r1 = $.eq(1, 2);
      const r2 = $.eq("a", "b");
      expectTypeOf(r1).toEqualTypeOf<Expr<boolean>>();
      expectTypeOf(r2).toEqualTypeOf<Expr<boolean>>();
      return $.do(r1, r2);
    });
    expect(prog.ast).toBeDefined();
    // Verify boolean eq is rejected at the type level (and throws at runtime)
    expect(() =>
      app(($) => {
        // @ts-expect-error — boolean plugin not loaded
        return $.eq(true, false);
      }),
    ).toThrow();
  });

  it("eq with all three type plugins accepts all", () => {
    const app = ilo(num, str, boolean, eq);
    const prog = app(($) => {
      const r1 = $.eq(1, 2);
      const r2 = $.eq("a", "b");
      const r3 = $.eq(true, false);
      expectTypeOf(r1).toEqualTypeOf<Expr<boolean>>();
      expectTypeOf(r2).toEqualTypeOf<Expr<boolean>>();
      expectTypeOf(r3).toEqualTypeOf<Expr<boolean>>();
      return $.do(r1, r2, r3);
    });
    expect(prog.ast).toBeDefined();
  });
});
