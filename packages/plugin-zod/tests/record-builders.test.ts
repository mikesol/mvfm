import { mvfm } from "@mvfm/core";
import { describe, expect, it } from "vitest";
import { ZodRecordBuilder, zod } from "../src/index";

// Helper: strip __id from AST for snapshot-stable assertions
function strip(ast: unknown): unknown {
  return JSON.parse(JSON.stringify(ast, (k, v) => (k === "__id" ? undefined : v)));
}

describe("record schemas (#115)", () => {
  it("$.zod.record() returns a ZodRecordBuilder", () => {
    const app = mvfm(zod);
    app(($) => {
      const builder = $.zod.record($.zod.string(), $.zod.string());
      expect(builder).toBeInstanceOf(ZodRecordBuilder);
      return builder.parse($.input);
    });
  });

  it("$.zod.record() produces zod/record AST with key and value schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.record($.zod.string(), $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/record");
    expect(ast.result.schema.key.kind).toBe("zod/string");
    expect(ast.result.schema.value.kind).toBe("zod/string");
    expect(ast.result.schema.mode).toBe("strict");
  });

  it("$.zod.partialRecord() sets mode to partial", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.partialRecord($.zod.string(), $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.mode).toBe("partial");
  });

  it("$.zod.looseRecord() sets mode to loose", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.looseRecord($.zod.string(), $.zod.string()).parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.mode).toBe("loose");
  });

  it("$.zod.record() accepts error param", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.record($.zod.string(), $.zod.string(), "Bad record!").parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.error).toBe("Bad record!");
  });

  it("wrappers work on record schemas", () => {
    const app = mvfm(zod);
    const prog = app(($) => {
      return $.zod.record($.zod.string(), $.zod.string()).optional().parse($.input);
    });
    const ast = strip(prog.ast) as any;
    expect(ast.result.schema.kind).toBe("zod/optional");
    expect(ast.result.schema.inner.kind).toBe("zod/record");
  });
});
