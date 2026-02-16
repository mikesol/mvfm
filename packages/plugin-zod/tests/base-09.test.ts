import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodUnionBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("union/xor schemas (#112)", () => {
  it("$.zod.union() returns a ZodUnionBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.union([$.zod.string(), $.zod.string()]);
      expect(builder).toBeInstanceOf(ZodUnionBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.union() produces zod/union AST with options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.union([$.zod.string(), $.zod.string()]).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/union");
    expect(ast.result.schema.options).toHaveLength(2);
    expect(ast.result.schema.options[0].kind).toBe("zod/string");
    expect(ast.result.schema.options[1].kind).toBe("zod/string");
  });

  it("$.zod.union() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.union([$.zod.string(), $.zod.string()], "Bad union!").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad union!");
  });

  it("$.zod.xor() produces zod/xor AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.xor([$.zod.string(), $.zod.string()]).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/xor");
    expect(ast.result.schema.options).toHaveLength(2);
  });

  it("wrappers work on union schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.union([$.zod.string(), $.zod.string()]).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/union");
  });
});
