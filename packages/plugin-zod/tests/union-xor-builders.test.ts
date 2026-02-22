import { describe, expect, it } from "vitest";
import { ZodUnionBuilder } from "../src/index";
import { $, schemaOf } from "./test-helpers";

describe("union/xor schemas (#112)", () => {
  it("$.zod.union() returns a ZodUnionBuilder", () => {
    expect($.zod.union([$.zod.string(), $.zod.string()])).toBeInstanceOf(ZodUnionBuilder);
  });

  it("$.zod.union() produces zod/union AST with options", () => {
    const schema = schemaOf($.zod.union([$.zod.string(), $.zod.string()]));
    expect(schema.kind).toBe("zod/union");
    expect(schema.options).toHaveLength(2);
    expect(schema.options[0].kind).toBe("zod/string");
    expect(schema.options[1].kind).toBe("zod/string");
  });

  it("$.zod.union() accepts error param", () => {
    const schema = schemaOf($.zod.union([$.zod.string(), $.zod.string()], "Bad union!"));
    expect(schema.error).toBe("Bad union!");
  });

  it("$.zod.xor() produces zod/xor AST", () => {
    const schema = schemaOf($.zod.xor([$.zod.string(), $.zod.string()]));
    expect(schema.kind).toBe("zod/xor");
    expect(schema.options).toHaveLength(2);
  });

  it("wrappers work on union schemas", () => {
    const schema = schemaOf($.zod.union([$.zod.string(), $.zod.string()]).optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/union");
  });
});
