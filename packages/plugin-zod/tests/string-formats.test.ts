import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("string format constructors (#101)", () => {
  it("email() produces zod/string node with format descriptor", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.email().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/string");
    expect(ast.result.schema.format).toEqual({ type: "email" });
  });

  it("uuid() produces format descriptor with optional version", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.uuid({ version: 4 }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "uuid", version: 4 });
  });

  it("uuidv4() produces uuidv4 format", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.uuidv4().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "uuidv4" });
  });

  it("url() produces url format", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.url().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "url" });
  });

  it("httpUrl() produces httpUrl format", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.httpUrl().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "httpUrl" });
  });

  it("jwt() produces format with optional alg", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.jwt({ alg: "HS256" }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "jwt", alg: "HS256" });
  });

  it("hash() produces format with algorithm", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.hash("sha256").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "hash", algorithm: "sha256" });
  });

  it("iso.datetime() produces iso.datetime format with options", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.iso.datetime({ precision: 3, offset: true }).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "iso.datetime", precision: 3, offset: true });
  });

  it("iso.date() produces iso.date format", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.iso.date().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "iso.date" });
  });

  it("format constructors accept error config", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.email("Bad email").parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad email");
    expect(ast.result.schema.format).toEqual({ type: "email" });
  });

  it("format schemas still have string checks array", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.email().min(5).parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.format).toEqual({ type: "email" });
    expect(ast.result.schema.checks).toHaveLength(1);
    expect(ast.result.schema.checks[0].kind).toBe("min_length");
  });

  it("format schemas support wrappers", () => {
    const app = mvfm(zod);
    const prog = app(($) => $.zod.email().optional().parse($.input));
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/string");
    expect(ast.result.schema.inner.format).toEqual({ type: "email" });
  });

  it("all simple format constructors produce correct format type", () => {
    const app = mvfm(zod);
    const formats = [
      "email",
      "guid",
      "hostname",
      "emoji",
      "base64",
      "base64url",
      "hex",
      "nanoid",
      "cuid",
      "cuid2",
      "ulid",
      "ipv4",
      "ipv6",
      "mac",
      "cidrv4",
      "cidrv6",
      "e164",
    ] as const;
    for (const fmt of formats) {
      const prog = app(($) => ($.zod as any)[fmt]().parse($.input));
      const ast = strip(prog.ast) as any;
      expect(ast.result.schema.format).toEqual({ type: fmt });
    }
  });
});
