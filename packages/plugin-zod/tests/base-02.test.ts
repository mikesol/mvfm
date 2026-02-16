import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("ZodSchemaBuilder base class", () => {
  it("_addCheck creates immutable chain", () => {
    const app = mvfm(zod);
    // Only return one parse result to avoid orphaned nodes
    const prog = app(($) => {
      const s1 = $.zod.string();
      const s2 = s1.min(5);
      const s3 = s2.max(10);

      // Each is a different instance (immutable chaining)
      expect(s1).not.toBe(s2);
      expect(s2).not.toBe(s3);

      // Return s3's parse — s3 should have 2 checks
      return s3.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0].kind).toBe("min_length");
    expect(ast.result.schema.checks[0].value).toBe(5);
    expect(ast.result.schema.checks[1].kind).toBe("max_length");
    expect(ast.result.schema.checks[1].value).toBe(10);
  });

  it("checks accept error/abort/when options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().min(5, { error: "Too short!", abort: true }).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const check = ast.result.schema.checks[0];
    expect(check.error).toBe("Too short!");
    expect(check.abort).toBe(true);
  });

  it("parse() produces zod/parse AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/parse");
    expect(ast.result.schema).toBeDefined();
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.input).toBeDefined();
  });

  it("safeParse() produces zod/safe_parse AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().safeParse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/safe_parse");
    expect(ast.result.schema.kind).toBe("zod/string");
  });

  it("chained checks appear in schema node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().min(3).max(100).safeParse($.input);
    });
    const ast = strip(prog.ast) as any;
    const schema = ast.result.schema;
    expect(schema.kind).toBe("zod/string");
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0]).toMatchObject({ kind: "min_length", value: 3 });
    expect(schema.checks[1]).toMatchObject({
      kind: "max_length",
      value: 100,
    });
  });

  it("parseAsync() produces zod/parse_async AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().parseAsync($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/parse_async");
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.input).toBeDefined();
  });

  it("safeParseAsync() produces zod/safe_parse_async AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().safeParseAsync($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/safe_parse_async");
    expect(ast.result.schema.kind).toBe("zod/string");
  });

  it("parse() accepts per-parse error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().parse($.input, { error: "Parse failed!" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/parse");
    expect(ast.result.parseError).toBe("Parse failed!");
  });

  it("safeParse() accepts per-parse error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().safeParse($.input, { error: "Validation error" });
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.kind).toBe("zod/safe_parse");
    expect(ast.result.parseError).toBe("Validation error");
  });

  it("parse() without error option omits parseError from AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.parseError).toBeUndefined();
  });
});
