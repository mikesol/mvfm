import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

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
