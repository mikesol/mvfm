import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodTemplateLiteralBuilder, zod } from "../src/index";

function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("template literal schemas (#156)", () => {
  it("$.zod.templateLiteral() returns a ZodTemplateLiteralBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.templateLiteral(["hello ", $.zod.string()]);
      expect(builder).toBeInstanceOf(ZodTemplateLiteralBuilder);
      return builder.parse(42);
    });
  });

  it("produces correct AST with string and schema parts", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.templateLiteral(["hello, ", $.zod.string(), "!"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(3);
    expect(ast.result.schema.parts[0]).toBe("hello, ");
    expect(ast.result.schema.parts[1].kind).toBe("zod/string");
    expect(ast.result.schema.parts[2]).toBe("!");
  });

  it("produces correct AST with number schema", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.templateLiteral([$.zod.number(), "px"]).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/template_literal");
    expect(ast.result.schema.parts).toHaveLength(2);
    expect(ast.result.schema.parts[0].kind).toBe("zod/number");
    expect(ast.result.schema.parts[1]).toBe("px");
  });

  it("inherits wrapper methods", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.templateLiteral(["test", $.zod.string()]).optional().parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/template_literal");
  });
});
