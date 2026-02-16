import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodPrimitiveBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("primitive types (#104)", () => {
  it("$.zod.boolean() produces zod/boolean AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.boolean().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/boolean");
  });

  it("$.zod.boolean() returns ZodPrimitiveBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      expect($.zod.boolean()).toBeInstanceOf(ZodPrimitiveBuilder);
      return $.zod.boolean().parse($.input);
    });
  });

  it("$.zod.boolean() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.boolean("Not boolean!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not boolean!");
  });

  it("$.zod.null() produces zod/null AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.null().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/null");
  });

  it("$.zod.undefined() produces zod/undefined AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.undefined().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/undefined");
  });

  it("$.zod.void() produces zod/void AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.void().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/void");
  });

  it("$.zod.symbol() produces zod/symbol AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.symbol().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/symbol");
  });

  it("primitives support wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.boolean().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/boolean");
  });
});
