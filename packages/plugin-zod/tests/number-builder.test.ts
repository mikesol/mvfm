import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodNumberBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

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
