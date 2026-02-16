import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodSimpleBuilder, ZodWrappedBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("special types (#120)", () => {
  it("$.zod.any() produces zod/any AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.any().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/any");
  });

  it("$.zod.any() returns ZodSimpleBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      expect($.zod.any()).toBeInstanceOf(ZodSimpleBuilder);
      return $.zod.any().parse($.input);
    });
  });

  it("$.zod.unknown() produces zod/unknown AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.unknown().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/unknown");
  });

  it("$.zod.never() produces zod/never AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.never().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/never");
  });

  it("$.zod.nan() produces zod/nan AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.nan().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nan");
  });

  it("$.zod.promise(inner) produces zod/promise wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.promise($.zod.string()).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/promise");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("$.zod.promise() returns ZodWrappedBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const wrapped = $.zod.promise($.zod.string());
      expect(wrapped).toBeInstanceOf(ZodWrappedBuilder);
      return wrapped.parse($.input);
    });
  });

  it("$.zod.custom(fn) produces zod/custom AST node with predicate", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.custom((val) => val).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/custom");
    expect(ast.result.schema.predicate.kind).toBe("core/lambda");
    expect(ast.result.schema.predicate.param.name).toBe("custom_val");
  });

  it("$.zod.custom(fn) accepts error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.custom((val) => val, "Must pass!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/custom");
    expect(ast.result.schema.error).toBe("Must pass!");
  });

  it("special types support wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.any().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/any");
  });
});
