import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodLazyBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("lazy schemas (#117)", () => {
  it("$.zod.lazy() returns a ZodLazyBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.lazy(() => $.zod.string());
      expect(builder).toBeInstanceOf(ZodLazyBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.lazy() produces zod/lazy AST with lazyId + target", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.lazy(() => $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/lazy");
    expect(ast.result.schema.lazyId).toMatch(/^zod_lazy_/);
    expect(ast.result.schema.target.kind).toBe("zod/string");
  });

  it("self-referential schema produces finite AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input);
    });

    // Verify the AST is finite (doesn't have infinite nesting)
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    const shape = ast.result.schema.shape;
    expect(shape.name.kind).toBe("zod/string");
    expect(shape.subcategories.kind).toBe("zod/lazy");
    expect(shape.subcategories.lazyId).toMatch(/^zod_lazy_/);
    expect(shape.subcategories.target.kind).toBe("zod/array");
    expect(shape.subcategories.target.element.kind).toBe("zod/object");
    expect(shape.subcategories.target.element.shape.subcategories.kind).toBe("zod/lazy_ref");
    expect(shape.subcategories.target.element.shape.subcategories.lazyId).toBe(
      shape.subcategories.lazyId,
    );
  });

  it("mutual recursion produces finite AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const User = $.zod.object({
        email: $.zod.string(),
        posts: $.zod.lazy(() => $.zod.array(Post)),
      });
      const Post = $.zod.object({
        title: $.zod.string(),
        author: $.zod.lazy(() => User),
      });
      return User.parse($.input);
    });

    // Verify both schemas produce finite ASTs
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/object");
    const userShape = ast.result.schema.shape;
    expect(userShape.email.kind).toBe("zod/string");
    expect(userShape.posts.kind).toBe("zod/lazy");
    expect(userShape.posts.target.kind).toBe("zod/array");
    expect(userShape.posts.target.element.kind).toBe("zod/object");
    expect(userShape.posts.target.element.shape.author.kind).toBe("zod/lazy");
  });

  it("lazy schema can be called multiple times", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const getter = () => $.zod.string();
      const lazy1 = $.zod.lazy(getter);
      // We can call lazy() multiple times with the same getter
      $.zod.lazy(getter);
      // Return just the first one - we're testing AST structure
      return lazy1.parse($.input.a);
    });

    const ast = prog.ast as any;
    // The lazy schema should exist in the AST
    expect(ast.result.schema.kind).toBe("zod/lazy");
  });

  it("lazy schema inherits base methods (optional, nullable)", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .lazy(() => $.zod.string())
        .optional()
        .parse($.input);
    });

    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/lazy");
  });

  it("different lazy targets produce different program hashes", () => {
    const app = mvfm(zod);
    const stringProg = app(($) => $.zod.lazy(() => $.zod.string()).parse($.input));
    const numberProg = app(($) => $.zod.lazy(() => $.zod.number()).parse($.input));
    expect(stringProg.hash).not.toBe(numberProg.hash);
  });
});
