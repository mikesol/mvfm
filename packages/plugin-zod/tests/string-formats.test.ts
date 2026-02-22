import { describe, expect, it } from "vitest";
import { $, schemaOf } from "./test-helpers";

describe("string format constructors (#101)", () => {
  it("email() produces zod/string node with format descriptor", () => {
    const schema = schemaOf($.zod.email());
    expect(schema.kind).toBe("zod/string");
    expect(schema.format).toEqual({ type: "email" });
  });

  it("uuid() produces format descriptor with optional version", () => {
    const schema = schemaOf($.zod.uuid({ version: 4 }));
    expect(schema.format).toEqual({ type: "uuid", version: 4 });
  });

  it("uuidv4() produces uuidv4 format", () => {
    const schema = schemaOf($.zod.uuidv4());
    expect(schema.format).toEqual({ type: "uuidv4" });
  });

  it("url() produces url format", () => {
    const schema = schemaOf($.zod.url());
    expect(schema.format).toEqual({ type: "url" });
  });

  it("httpUrl() produces httpUrl format", () => {
    const schema = schemaOf($.zod.httpUrl());
    expect(schema.format).toEqual({ type: "httpUrl" });
  });

  it("jwt() produces format with optional alg", () => {
    const schema = schemaOf($.zod.jwt({ alg: "HS256" }));
    expect(schema.format).toEqual({ type: "jwt", alg: "HS256" });
  });

  it("hash() produces format with algorithm", () => {
    const schema = schemaOf($.zod.hash("sha256"));
    expect(schema.format).toEqual({ type: "hash", algorithm: "sha256" });
  });

  it("iso.datetime() produces iso.datetime format with options", () => {
    const schema = schemaOf($.zod.iso.datetime({ precision: 3, offset: true }));
    expect(schema.format).toEqual({ type: "iso.datetime", precision: 3, offset: true });
  });

  it("iso.date() produces iso.date format", () => {
    const schema = schemaOf($.zod.iso.date());
    expect(schema.format).toEqual({ type: "iso.date" });
  });

  it("format constructors accept error config", () => {
    const schema = schemaOf($.zod.email("Bad email"));
    expect(schema.error).toBe("Bad email");
    expect(schema.format).toEqual({ type: "email" });
  });

  it("format schemas still have string checks array", () => {
    const schema = schemaOf($.zod.email().min(5));
    expect(schema.format).toEqual({ type: "email" });
    expect(schema.checks).toHaveLength(1);
    expect(schema.checks[0].kind).toBe("min_length");
  });

  it("format schemas support wrappers", () => {
    const schema = schemaOf($.zod.email().optional());
    expect(schema.kind).toBe("zod/optional");
    expect(schema.inner.kind).toBe("zod/string");
    expect(schema.inner.format).toEqual({ type: "email" });
  });

  it("all simple format constructors produce correct format type", () => {
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
      const schema = schemaOf(($.zod as any)[fmt]());
      expect(schema.format).toEqual({ type: fmt });
    }
  });
});
