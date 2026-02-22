import { describe, expect, it } from "vitest";
import { ZodRecordBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("record schemas (#115)", () => {
  it("$.zod.record() returns a ZodRecordBuilder", () => {
    expect($.zod.record($.zod.string(), $.zod.string())).toBeInstanceOf(ZodRecordBuilder);
  });

  it("$.zod.record() produces zod/record AST with key and value schemas", () => {
    const schema = schemaOf($.zod.record($.zod.string(), $.zod.string()));
    expect(schema.kind).toBe("zod/record");
    expect(schema.key.kind).toBe("zod/string");
    expect(schema.value.kind).toBe("zod/string");
    expect(schema.mode).toBe("strict");
  });

  it("$.zod.partialRecord() sets mode to partial", () => {
    const schema = schemaOf($.zod.partialRecord($.zod.string(), $.zod.string()));
    expect(schema.mode).toBe("partial");
  });

  it("$.zod.looseRecord() sets mode to loose", () => {
    const schema = schemaOf($.zod.looseRecord($.zod.string(), $.zod.string()));
    expect(schema.mode).toBe("loose");
  });

  it("$.zod.record() accepts error param", () => {
    const schema = schemaOf($.zod.record($.zod.string(), $.zod.string(), "Bad record!"));
    expect(schema.error).toBe("Bad record!");
  });

  it("wrappers work on record schemas", () => {
    const schema = schemaOf($.zod.record($.zod.string(), $.zod.string()).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/record");
  });
});
