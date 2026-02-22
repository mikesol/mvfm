import { describe, expect, it } from "vitest";
import { ZodStringBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("zod plugin scaffolding", () => {
  it("$.zod namespace is available", () => {
    expect($.zod).toBeDefined();
    expect(typeof $.zod.string).toBe("function");
  });

  it("$.zod.string() returns a ZodStringBuilder", () => {
    expect($.zod.string()).toBeInstanceOf(ZodStringBuilder);
  });

  it("$.zod.string() accepts error param as string", () => {
    const schema = schemaOf($.zod.string("Not a string!"));
    expect(schema.error).toBe("Not a string!");
  });

  it("$.zod.string() accepts error param as object", () => {
    const schema = schemaOf($.zod.string({ error: "Bad!" }));
    expect(schema.error).toBe("Bad!");
  });
});
