import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodIntersectionBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("intersection schemas (#114)", () => {
  it("$.zod.intersection() returns a ZodIntersectionBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.intersection($.zod.string(), $.zod.string());
      expect(builder).toBeInstanceOf(ZodIntersectionBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.intersection() produces zod/intersection AST with left and right", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.intersection($.zod.string(), $.zod.string().min(3)).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/intersection");
    expect(ast.result.schema.left).toBeDefined();
    expect(ast.result.schema.left.kind).toBe("zod/string");
    expect(ast.result.schema.right).toBeDefined();
    expect(ast.result.schema.right.kind).toBe("zod/string");
    expect(ast.result.schema.right.checks).toHaveLength(1);
  });

  it("$.zod.intersection() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .intersection($.zod.string(), $.zod.string(), "Intersection fail!")
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Intersection fail!");
  });

  it("wrappers work on intersection schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.intersection($.zod.string(), $.zod.string()).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/intersection");
  });
});
