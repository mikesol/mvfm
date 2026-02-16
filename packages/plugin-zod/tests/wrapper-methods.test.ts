import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodWrappedBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

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
