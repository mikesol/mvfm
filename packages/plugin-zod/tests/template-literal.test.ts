import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodTemplateLiteralBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("template literal schemas (#119)", () => {
  it("$.zod.templateLiteral() returns a ZodTemplateLiteralBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]);
      expect(builder).toBeInstanceOf(ZodTemplateLiteralBuilder);
      return builder.parse("test");
    });
  });

  it("template literal with static and dynamic parts produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(3);
    expect(ast.result.schema.parts[0]).toBe("hello, ");
    expect(ast.result.schema.parts[1].kind).toBe("zod/string");
    expect(ast.result.schema.parts[2]).toBe("!");
  });

  it("template literal with number and enum produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.templateLiteral([$.zod.number(), $.zod.enum(["px", "em", "rem"])]).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(2);
    expect(ast.result.schema.parts[0].kind).toBe("zod/number");
    expect(ast.result.schema.parts[1].kind).toBe("zod/enum");
  });

  it("template literal with only static strings produces correct AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.templateLiteral(["hello"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(1);
    expect(ast.result.schema.parts[0]).toBe("hello");
  });

  it("template literal with custom error message", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .templateLiteral(["hello, ", $.zod.string(), "!"], { error: "custom error" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.error).toBe("custom error");
  });

  it("template literal inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).optional().parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/template_literal");
  });

  it("template literal inherits refinement methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod
        .templateLiteral(["hello, ", $.zod.string(), "!"])
        .refine((val) => val, { error: "must match pattern" })
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(1);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
  });
});
