import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodBigIntBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("bigint schema (#103)", () => {
  it("$.zod.bigint() returns a ZodBigIntBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.bigint();
      expect(builder).toBeInstanceOf(ZodBigIntBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.bigint() produces zod/bigint AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.bigint().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/bigint");
    expect(ast.result.schema.checks).toEqual([]);
  });

  it("$.zod.bigint() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.bigint("Not a bigint!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not a bigint!");
  });

  it("gt() serializes bigint value as string", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.bigint().gt(5n).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "gt", value: "5" });
  });

  it("gte() and min() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.bigint().gte(10n).parse($.input));
    const prog2 = app(($) => $.zod.bigint().min(10n).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "gte", value: "10" });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "gte", value: "10" });
  });

  it("lte() and max() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.bigint().lte(50n).parse($.input));
    const prog2 = app(($) => $.zod.bigint().max(50n).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "lte", value: "50" });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "lte", value: "50" });
  });

  it("sign checks produce correct descriptors", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.bigint().positive().nonnegative().negative().nonpositive().parse($.input),
    );
    const ast = strip(prog.ast) as any;
    const kinds = ast.result.schema.checks.map((c: any) => c.kind);
    expect(kinds).toEqual(["positive", "nonnegative", "negative", "nonpositive"]);
  });

  it("multipleOf() and step() are aliases", () => {
    const app = mvfm(zod);
    const prog1 = app(($) => $.zod.bigint().multipleOf(3n).parse($.input));
    const prog2 = app(($) => $.zod.bigint().step(3n).parse($.input));
    const ast1 = strip(prog1.ast) as any;
    const ast2 = strip(prog2.ast) as any;
    expect(ast1.result.schema.checks[0]).toMatchObject({ kind: "multiple_of", value: "3" });
    expect(ast2.result.schema.checks[0]).toMatchObject({ kind: "multiple_of", value: "3" });
  });

  it("chained checks accumulate immutably", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const b1 = $.zod.bigint();
      const b2 = b1.gt(0n);
      const b3 = b2.lt(100n);
      expect(b1).not.toBe(b2);
      expect(b2).not.toBe(b3);
      return b3.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
  });
});
