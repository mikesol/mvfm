import type { Expr } from "@mvfm/core";
import { mvfm } from "@mvfm/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { postgres } from "../../src/3.4.8";

describe("non-typeclass plugin isolation", () => {
  it("non-typeclass plugins work without any type plugins", () => {
    const app = mvfm(postgres("postgres://localhost/test"));
    app(($) => {
      const result = $.sql`select 1`;
      expectTypeOf(result).toEqualTypeOf<Expr<Record<string, any>[]>>();
      return result;
    });
  });
});
