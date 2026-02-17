import { defaults, foldAST, injectInput, mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

describe("lazy schema interpreter (#117)", () => {
  it("validates a simple lazy schema", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "string" }, ($) => {
      return $.zod.lazy(() => $.zod.string()).parse($.input.value);
    });

    const result = await foldAST(defaults(app), injectInput(prog, { value: "hello" }));
    expect(result).toBe("hello");
  });

  it("validates self-referential schema", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input.value);
    });

    const input = {
      name: "Electronics",
      subcategories: [
        { name: "Laptops", subcategories: [] },
        { name: "Phones", subcategories: [] },
      ],
    };

    const result = await foldAST(defaults(app), injectInput(prog, { value: input }));
    expect(result).toEqual(input);
  });

  it("validates mutual recursion", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const User = $.zod.object({
        email: $.zod.string(),
        posts: $.zod.lazy(() => $.zod.array(Post)),
      });
      const Post = $.zod.object({
        title: $.zod.string(),
        author: $.zod.lazy(() => User),
      });
      return User.parse($.input.value);
    });

    const input = {
      email: "user@example.com",
      posts: [
        {
          title: "First Post",
          author: {
            email: "user@example.com",
            posts: [],
          },
        },
      ],
    };

    const result = await foldAST(defaults(app), injectInput(prog, { value: input }));
    expect(result).toEqual(input);
  });

  it("validates nested self-referential schema", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const TreeNode = $.zod.object({
        value: $.zod.number(),
        children: $.zod.lazy(() => $.zod.array(TreeNode)),
      });
      return TreeNode.parse($.input.value);
    });

    const input = {
      value: 1,
      children: [
        { value: 2, children: [] },
        {
          value: 3,
          children: [{ value: 4, children: [] }],
        },
      ],
    };

    const result = await foldAST(defaults(app), injectInput(prog, { value: input }));
    expect(result).toEqual(input);
  });

  it("rejects invalid data in lazy schema", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.safeParse($.input.value);
    });

    const input = {
      name: "Electronics",
      subcategories: [
        { name: 123, subcategories: [] }, // Invalid: name should be string
      ],
    };

    const result = await foldAST(defaults(app), injectInput(prog, { value: input }));
    expect(result.success).toBe(false);
  });

  it("handles empty recursion", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input.value);
    });

    const input = {
      name: "Root",
      subcategories: [],
    };

    const result = await foldAST(defaults(app), injectInput(prog, { value: input }));
    expect(result).toEqual(input);
  });

  it("validates after JSON round-trip (no runtime closures in AST)", async () => {
    const app = mvfm(zod);
    const prog = app({ value: "object" }, ($) => {
      const Category = $.zod.object({
        name: $.zod.string(),
        subcategories: $.zod.lazy(() => $.zod.array(Category)),
      });
      return Category.parse($.input.value);
    });

    const serialized = JSON.stringify(prog);
    const hydrated = JSON.parse(serialized);
    const input = { value: { name: "Root", subcategories: [] } };

    const result = await foldAST(defaults(app), injectInput(hydrated, input));
    expect(result).toEqual(input.value);
  });
});
