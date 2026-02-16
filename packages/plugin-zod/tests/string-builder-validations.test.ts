import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

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
