import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodMapBuilder, ZodSetBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("map/set schemas (#116)", () => {
  it("$.zod.map() returns a ZodMapBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.map($.zod.string(), $.zod.string());
      expect(builder).toBeInstanceOf(ZodMapBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.map() produces zod/map AST with key and value schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.map($.zod.string(), $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/map");
    expect(ast.result.schema.key.kind).toBe("zod/string");
    expect(ast.result.schema.value.kind).toBe("zod/string");
  });

  it("$.zod.set() returns a ZodSetBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.set($.zod.string());
      expect(builder).toBeInstanceOf(ZodSetBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.set() produces zod/set AST with value schema", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.set($.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/set");
    expect(ast.result.schema.value.kind).toBe("zod/string");
  });

  it("set size checks chain correctly", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.set($.zod.string()).min(2).max(5).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks).toHaveLength(2);
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "min_size", value: 2 });
    expect(ast.result.schema.checks[1]).toMatchObject({ kind: "max_size", value: 5 });
  });

  it("set size() adds exact size check", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.set($.zod.string()).size(3).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.checks[0]).toMatchObject({ kind: "size", value: 3 });
  });

  it("wrappers work on map/set schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.set($.zod.string()).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/set");
  });
});
