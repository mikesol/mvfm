import { describe, expect, expectTypeOf, it } from "vitest";
import type { InferSchema } from "../src/schema";
import { array, nullable } from "../src/schema";

describe("schema helpers", () => {
  it("array() returns tagged object", () => {
    const s = array("number");
    expect(s).toEqual({ __tag: "array", of: "number" });
  });

  it("nullable() returns tagged object", () => {
    const s = nullable("string");
    expect(s).toEqual({ __tag: "nullable", of: "string" });
  });

  it("nested array", () => {
    const s = array(array("number"));
    expect(s).toEqual({ __tag: "array", of: { __tag: "array", of: "number" } });
  });
});

describe("schema type inference", () => {
  it("primitive tags infer correct types", () => {
    expectTypeOf<InferSchema<"string">>().toEqualTypeOf<string>();
    expectTypeOf<InferSchema<"number">>().toEqualTypeOf<number>();
    expectTypeOf<InferSchema<"boolean">>().toEqualTypeOf<boolean>();
    expectTypeOf<InferSchema<"date">>().toEqualTypeOf<Date>();
    expectTypeOf<InferSchema<"null">>().toEqualTypeOf<null>();
  });

  it("array tag infers array type", () => {
    expectTypeOf<InferSchema<{ __tag: "array"; of: "number" }>>().toEqualTypeOf<number[]>();
  });

  it("nullable tag infers union type", () => {
    expectTypeOf<InferSchema<{ __tag: "nullable"; of: "string" }>>().toEqualTypeOf<string | null>();
  });

  it("record schema infers record type", () => {
    type S = { name: "string"; age: "number" };
    expectTypeOf<InferSchema<S>>().toEqualTypeOf<{ name: string; age: number }>();
  });

  it("nested record schema infers nested type", () => {
    type S = { user: { name: "string"; score: "number" } };
    expectTypeOf<InferSchema<S>>().toEqualTypeOf<{ user: { name: string; score: number } }>();
  });
});
