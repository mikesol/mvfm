import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodStringBuilder, ZodWrappedBuilder, zod } from "../src/index";

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

describe("wrapper methods (#99)", () => {
  it("optional() produces zod/optional wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("nullable() produces zod/nullable wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().nullable().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nullable");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("nullish() produces zod/nullish wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().nullish().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nullish");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("nonoptional() produces zod/nonoptional wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().nonoptional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nonoptional");
  });

  it("default() produces zod/default wrapper with value", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().default("hello").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/default");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.value).toBeDefined();
  });

  it("catch() produces zod/catch wrapper with value", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().catch("fallback").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/catch");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.value).toBeDefined();
  });

  it("readonly() produces zod/readonly wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().readonly().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/readonly");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });

  it("brand() produces zod/branded wrapper node", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().brand("Email").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/branded");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.brand).toBe("Email");
  });

  it("wrappers compose: optional().nullable() nests correctly", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().min(3).optional().nullable().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const schema = ast.result.schema;
    expect(schema.kind).toBe("zod/nullable");
    expect(schema.inner.kind).toBe("zod/optional");
    expect(schema.inner.inner.kind).toBe("zod/string");
    expect(schema.inner.inner.checks).toHaveLength(1);
    expect(schema.inner.inner.checks[0].kind).toBe("min_length");
  });

  it("optional() returns ZodWrappedBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const wrapped = $.zod.string().optional();
      expect(wrapped).toBeInstanceOf(ZodWrappedBuilder);
      return wrapped.parse($.input);
    });
  });

  it("prefault() produces zod/prefault wrapper with value", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.string().prefault("pre").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/prefault");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
  });
});
