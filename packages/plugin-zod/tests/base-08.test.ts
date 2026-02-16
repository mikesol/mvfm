import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodTupleBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("tuple schemas (#111)", () => {
  it("$.zod.tuple() returns a ZodTupleBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.tuple([$.zod.string()]);
      expect(builder).toBeInstanceOf(ZodTupleBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.tuple() produces zod/tuple AST with items", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.tuple([$.zod.string(), $.zod.string()]).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/tuple");
    expect(ast.result.schema.items).toHaveLength(2);
    expect(ast.result.schema.items[0].kind).toBe("zod/string");
    expect(ast.result.schema.items[1].kind).toBe("zod/string");
  });

  it("$.zod.tuple() with rest element", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.tuple([$.zod.string()], $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/tuple");
    expect(ast.result.schema.items).toHaveLength(1);
    expect(ast.result.schema.rest).toBeDefined();
    expect(ast.result.schema.rest.kind).toBe("zod/string");
  });

  it("$.zod.tuple() without rest omits rest field", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.tuple([$.zod.string()]).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.rest).toBeUndefined();
  });

  it("$.zod.tuple() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.tuple([$.zod.string()], undefined, "Must be tuple!").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Must be tuple!");
  });

  it("wrappers work on tuple schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.tuple([$.zod.string()]).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/tuple");
  });
});
