import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodDateBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("date schema (#105)", () => {
  it("$.zod.date() produces zod/date AST node", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.date().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/date");
    expect(ast.result.schema.checks).toEqual([]);
  });

  it("$.zod.date() returns ZodDateBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      expect($.zod.date()).toBeInstanceOf(ZodDateBuilder);
      return $.zod.date().parse($.input);
    });
  });

  it("$.zod.date() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.date("Not a date!").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Not a date!");
  });

  it("min() produces min check with ISO date string", () => {
    const app = mvfm(zod);
    const minDate = new Date("2000-01-01T00:00:00.000Z");
    const prog = app(($) => $.zod.date().min(minDate).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0].kind).toBe("min");
    expect(ast.result.schema.checks[0].value).toBe("2000-01-01T00:00:00.000Z");
  });

  it("max() produces max check with ISO date string", () => {
    const app = mvfm(zod);
    const maxDate = new Date("2030-12-31T23:59:59.999Z");
    const prog = app(($) => $.zod.date().max(maxDate).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0].kind).toBe("max");
    expect(ast.result.schema.checks[0].value).toBe("2030-12-31T23:59:59.999Z");
  });

  it("min/max chain immutably", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      const d1 = $.zod.date();
      const d2 = d1.min(new Date("2000-01-01"));
      const d3 = d2.max(new Date("2030-12-31"));
      expect(d1).not.toBe(d2);
      expect(d2).not.toBe(d3);
      return d3.parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0].kind).toBe("min");
    expect(ast.result.schema.checks[1].kind).toBe("max");
  });

  it("check-level error options work on date checks", () => {
    const app = mvfm(zod);
    const prog = app(($) =>
      $.zod.date().min(new Date("2000-01-01"), { error: "Too early" }).parse($.input),
    );
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0].error).toBe("Too early");
  });

  it("date supports wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.date().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/date");
  });
});
