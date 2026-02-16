import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("coercion constructors (#106)", () => {
  it("$.zod.coerce.string() produces zod/string node with coerce flag", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.string().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.schema.coerce).toBe(true);
  });

  it("coerced string still supports checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.string().min(3).max(10).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBe(true);
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0].kind).toBe("min_length");
    expect(ast.result.schema.checks[1].kind).toBe("max_length");
  });

  it("coerced string supports wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.string().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.inner.coerce).toBe(true);
  });

  it("coerced string accepts error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.string("Must be coercible").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBe(true);
    expect(ast.result.schema.error).toBe("Must be coercible");
  });

  it("non-coerced string does not have coerce flag", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.string().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBeUndefined();
  });

  it("$.zod.coerce.number() produces zod/number node with coerce flag", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.number().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/number");
    expect(ast.result.schema.coerce).toBe(true);
  });

  it("coerced number still supports checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.number().gt(0).lt(100).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBe(true);
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0].kind).toBe("gt");
    expect(ast.result.schema.checks[1].kind).toBe("lt");
  });

  it("coerced number accepts error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.coerce.number("Must be coercible").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBe(true);
    expect(ast.result.schema.error).toBe("Must be coercible");
  });

  it("non-coerced number does not have coerce flag", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.coerce).toBeUndefined();
  });
});
