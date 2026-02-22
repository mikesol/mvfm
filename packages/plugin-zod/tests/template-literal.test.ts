import { describe, expect, it } from "vitest";
import { ZodTemplateLiteralBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("template literal schemas (#156)", () => {
  it("$.zod.templateLiteral() returns a ZodTemplateLiteralBuilder", () => {
    expect($.zod.templateLiteral(["hello ", $.zod.string()])).toBeInstanceOf(
      ZodTemplateLiteralBuilder,
    );
  });

  it("produces correct AST with string and schema parts", () => {
    const schema = schemaOf($.zod.templateLiteral(["hello, ", $.zod.string(), "!"]));
    expect(schema.kind).toBe("zod/template_literal");
    expect(schema.parts).toHaveLength(3);
    expect(schema.parts[0]).toBe("hello, ");
    expect(schema.parts[1].kind).toBe("zod/string");
    expect(schema.parts[2]).toBe("!");
  });

  it("produces correct AST with number schema", () => {
    const schema = schemaOf($.zod.templateLiteral([$.zod.number(), "px"]));
    expect(schema.kind).toBe("zod/template_literal");
    expect(schema.parts).toHaveLength(2);
    expect(schema.parts[0].kind).toBe("zod/number");
    expect(schema.parts[1]).toBe("px");
  });

  it("inherits wrapper methods", () => {
    const schema = schemaOf($.zod.templateLiteral(["test", $.zod.string()]).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/template_literal");
  });
});
