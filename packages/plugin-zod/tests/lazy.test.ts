import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodLazyBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("lazy schemas (#117, #154)", () => {
  it("$.zod.lazy() returns a ZodLazyBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.lazy(() => $.zod.string());
      expect(builder).toBeInstanceOf(ZodLazyBuilder);
      return builder.parse(42);
    });
  });

  it("lazy schema produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.lazy(() => $.zod.string()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/lazy");
    expect(ast.result.schema.ref).toBeDefined();
    expect(typeof ast.result.schema.ref).toBe("string");
  });

  it("lazy schema with object produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    expect(ast.result.schema.shape.subcategories.kind).toBe("zod/lazy");
    expect(ast.result.schema.shape.subcategories.ref).toBeDefined();
  });

  it("lazy inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.lazy(() => $.zod.string()).optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/lazy");
    expect(ast.result.schema.inner.ref).toBeDefined();
  });

  it("lazy inherits refinement methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .lazy(() => $.zod.string())
        .refine((val) => val, { error: "must be valid" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(1);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
  });
});
