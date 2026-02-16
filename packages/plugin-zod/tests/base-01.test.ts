import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodStringBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("zod plugin scaffolding", () => {
  it("registers as a plugin with mvfm", () => {
    const app = mvfm(zod);
    expect(app).toBeDefined();
    expect(typeof app).toBe("function");
  });

  it("$.zod namespace is available", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      expect($.zod).toBeDefined();
      expect(typeof $.zod.string).toBe("function");
      return $.zod.string().parse(42);
    });
    expect(prog).toBeDefined();
  });

  it("$.zod.string() returns a ZodStringBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.string();
      expect(builder).toBeInstanceOf(ZodStringBuilder);
      return builder.parse(42);
    });
  });

  it("$.zod.string() accepts error param as string", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string("Not a string!").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not a string!");
  });

  it("$.zod.string() accepts error param as object", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string({ error: "Bad!" }).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad!");
  });
});
