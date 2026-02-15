import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodNumberBuilder, ZodStringBuilder, ZodWrappedBuilder, zod } from "../src/index";

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

describe("refinement methods (#98)", () => {
  it("refine() produces refinement descriptor with lambda", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .refine((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const schema = ast.result.schema;
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
    expect(schema.refinements[0].fn.kind).toBe("core/lambda");
    expect(schema.refinements[0].fn.param.kind).toBe("core/lambda_param");
    expect(schema.refinements[0].fn.param.name).toBe("refine_val");
  });

  it("refine() captures predicate body AST", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .refine((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const fn = ast.result.schema.refinements[0].fn;
    // Body should reference the lambda param (proxy returns the param node via property access)
    expect(fn.body).toBeDefined();
  });

  it("refine() accepts error/abort/path options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .refine((val) => val, {
          error: "Must be valid!",
          abort: true,
          path: ["field", "sub"],
        })
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.error).toBe("Must be valid!");
    expect(refinement.abort).toBe(true);
    expect(refinement.path).toEqual(["field", "sub"]);
  });

  it("multiple refine() calls chain immutably", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const s1 = $.zod.string();
      const s2 = s1.refine((val) => val);
      const s3 = s2.refine((val) => val, { error: "second" });
      expect(s1).not.toBe(s2);
      expect(s2).not.toBe(s3);
      return s3.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.refinements).toHaveLength(2);
    expect(ast.result.schema.refinements[0].kind).toBe("refine");
    expect(ast.result.schema.refinements[1].kind).toBe("refine");
    expect(ast.result.schema.refinements[1].error).toBe("second");
  });

  it("superRefine() produces super_refine descriptor", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .superRefine((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.kind).toBe("super_refine");
    expect(refinement.fn.kind).toBe("core/lambda");
  });

  it("check() produces check descriptor", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .check((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.kind).toBe("check");
    expect(refinement.fn.kind).toBe("core/lambda");
  });

  it("overwrite() produces overwrite descriptor", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .overwrite((val) => val)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.kind).toBe("overwrite");
    expect(refinement.fn.kind).toBe("core/lambda");
  });

  it("refinements coexist with checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .min(3)
        .refine((val) => val, { error: "custom" })
        .max(100)
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const schema = ast.result.schema;
    expect(schema.checks).toHaveLength(2);
    expect(schema.checks[0].kind).toBe("min_length");
    expect(schema.checks[1].kind).toBe("max_length");
    expect(schema.refinements).toHaveLength(1);
    expect(schema.refinements[0].kind).toBe("refine");
    expect(schema.refinements[0].error).toBe("custom");
  });

  it("superRefine() accepts error/abort options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .superRefine((val) => val, { error: "super error", abort: true })
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.error).toBe("super error");
    expect(refinement.abort).toBe(true);
  });

  it("overwrite() accepts error/when options", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod
        .string()
        .overwrite((val) => val, { error: "overwrite error" })
        .parse($.input);
    });
    const ast = strip(prog.ast) as any;
    const refinement = ast.result.schema.refinements[0];
    expect(refinement.error).toBe("overwrite error");
  });
});

describe("zod string: full validations (#100)", () => {
  const app = mvfm(zod);

  it("length() produces length check", () => {
    const prog = app(($) => $.zod.string().length(5).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "length", value: 5 });
  });

  it("regex() produces regex check with pattern and flags", () => {
    const prog = app(($) =>
      $.zod
        .string()
        .regex(/^[a-z]+$/i)
        .parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({
      kind: "regex",
      pattern: "^[a-z]+$",
      flags: "i",
    });
  });

  it("startsWith() produces starts_with check", () => {
    const prog = app(($) => $.zod.string().startsWith("hello").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "starts_with", value: "hello" });
  });

  it("endsWith() produces ends_with check", () => {
    const prog = app(($) => $.zod.string().endsWith("!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "ends_with", value: "!" });
  });

  it("includes() produces includes check", () => {
    const prog = app(($) => $.zod.string().includes("@").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "includes", value: "@" });
  });

  it("uppercase() produces uppercase check", () => {
    const prog = app(($) => $.zod.string().uppercase().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "uppercase" });
  });

  it("lowercase() produces lowercase check", () => {
    const prog = app(($) => $.zod.string().lowercase().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "lowercase" });
  });

  it("trim() produces trim check", () => {
    const prog = app(($) => $.zod.string().trim().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "trim" });
  });

  it("toLowerCase() produces to_lower_case check", () => {
    const prog = app(($) => $.zod.string().toLowerCase().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "to_lower_case" });
  });

  it("toUpperCase() produces to_upper_case check", () => {
    const prog = app(($) => $.zod.string().toUpperCase().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "to_upper_case" });
  });

  it("normalize() produces normalize check with default NFC", () => {
    const prog = app(($) => $.zod.string().normalize().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "normalize", form: "NFC" });
  });

  it("normalize(form) passes custom form", () => {
    const prog = app(($) => $.zod.string().normalize("NFKD").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toEqual({ kind: "normalize", form: "NFKD" });
  });

  it("chaining multiple checks accumulates in order", () => {
    const prog = app(($) =>
      $.zod.string().min(1).max(100).startsWith("a").endsWith("z").parse($.input),
    );
    const ast = strip(prog.ast) as any;
    const kinds = ast.result.schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["min_length", "max_length", "starts_with", "ends_with"]);
  });

  it("error option flows through to check descriptor", () => {
    const prog = app(($) =>
      $.zod.string().startsWith("x", { error: "Must start with x" }).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0].error).toBe("Must start with x");
  });
});

describe("number schema (#102)", () => {
  it("$.zod.number() returns a ZodNumberBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.number();
      expect(builder).toBeInstanceOf(ZodNumberBuilder);
      return builder.parse(42);
    });
  });

  it("$.zod.number() produces zod/number AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/number");
    expect(ast.result.schema.checks).toEqual([]);
  });

  it("$.zod.number() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number("Not a number!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not a number!");
  });

  it("gt() adds gt check", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().gt(5).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "gt", value: 5 });
  });

  it("gte() and min() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.number().gte(10).parse($.input));
    const prog2 = app(($) => $.zod.number().min(10).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "gte", value: 10 });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "gte", value: 10 });
  });

  it("lt() adds lt check", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().lt(100).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "lt", value: 100 });
  });

  it("lte() and max() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.number().lte(50).parse($.input));
    const prog2 = app(($) => $.zod.number().max(50).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "lte", value: 50 });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "lte", value: 50 });
  });

  it("positive/nonnegative/negative/nonpositive add sign checks", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.number().positive().nonnegative().negative().nonpositive().parse($.input),
    );
    const ast = strip(prog.ast) as any;
    const kinds = ast.result.schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["positive", "nonnegative", "negative", "nonpositive"]);
  });

  it("multipleOf() and step() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.number().multipleOf(3).parse($.input));
    const prog2 = app(($) => $.zod.number().step(3).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "multiple_of", value: 3 });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "multiple_of", value: 3 });
  });

  it("int/finite/safe checks produce correct descriptors", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().int().finite().safe().parse($.input));
    const ast = strip(prog.ast) as any;
    const kinds = ast.result.schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["int", "finite", "safe"]);
  });

  it("integer variants set variant field", () => {
    const app = mvfm(zod);
    for (const v of ["int", "int32", "int64", "uint32", "uint64", "float32", "float64"] as const) {
      const prog = app(($) => $.zod[v]().parse($.input));
      const ast = strip(prog.ast) as any;
      expect(ast.result.schema.kind).toBe("zod/number");
      expect(ast.result.schema.variant).toBe(v);
    }
  });

  it("$.zod.nan() produces zod/nan AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.nan().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/nan");
  });

  it("chained number checks accumulate immutably", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const n1 = $.zod.number();
      const n2 = n1.gt(0);
      const n3 = n2.lt(100);
      expect(n1).not.toBe(n2);
      expect(n2).not.toBe(n3);
      return n3.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "gt", value: 0 });
    expect(ast.result.schema.checks[1]).toMatchObject({ kind: "lt", value: 100 });
  });

  it("check-level error options work on number checks", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.number().gt(0, { error: "Must be positive!" }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0].error).toBe("Must be positive!");
  });
});
